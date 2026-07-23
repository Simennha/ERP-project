import { Logger } from '@nestjs/common';
import type { PrismaClient } from '@erp/database';
import type { ClsService } from 'nestjs-cls';
import { CLS_COMPANY_ID, CLS_USER_ID } from '../../common/cls/cls-keys';
import type { AuditService } from './audit.service';

/**
 * Models that get automatic before/after audit entries on update/delete.
 *
 * HOW TO ADD A NEW AUDITABLE MODEL (the only change required):
 *   1. Add the Prisma model name to this array, e.g. `['Role', 'User', 'Product']`.
 * That is it. `createAuditExtension` builds the query-extension hooks by
 * iterating this array, so a new entry is automatically wired for update/delete.
 *
 * Expectation: an auditable model SHOULD have a `companyId` scalar column (both
 * Role and User do). It is read from the row to stamp the audit entry's company;
 * if absent, the extension falls back to the CLS request context, and if that is
 * also missing the entry is skipped (audit must never break the business write).
 *
 * This is a deliberately explicit starting point, NOT a fully generic
 * reflection-based system: only single-record `update` and `delete` are hooked
 * (not `updateMany` / `deleteMany`, which have no single "before" row), and the
 * diff is a shallow, top-level scalar comparison.
 */
export const AUDITABLE_MODELS = ['Role', 'User'] as const;
export type AuditableModel = (typeof AUDITABLE_MODELS)[number];

/** Field values that must never be persisted into the audit trail. */
const REDACTED_FIELDS = new Set<string>(['passwordHash']);

/** Fields excluded from diffs because they change on every write / are noise. */
const IGNORED_FIELDS = new Set<string>(['updatedAt']);

const REDACTED = '[redacted]';

/** Prisma delegate name for a model, e.g. 'Role' -> 'role', 'User' -> 'user'. */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type Row = Record<string, unknown> & { id: string; companyId?: string };

/** Normalize values so Dates compare by value rather than identity. */
function normalize(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

/** Full snapshot of a row with sensitive fields redacted (used for deletes). */
function snapshot(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = REDACTED_FIELDS.has(key) ? REDACTED : value;
  }
  return out;
}

/**
 * Shallow, top-level diff of changed scalar fields as `{ field: { from, to } }`.
 * Redacted fields are reported as changed without exposing their values.
 */
function shallowDiff(before: Row, after: Row): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;

    const from = before[key];
    const to = after[key];
    if (Object.is(normalize(from), normalize(to))) continue;

    changes[key] = REDACTED_FIELDS.has(key)
      ? { from: REDACTED, to: REDACTED }
      : { from: from ?? null, to: to ?? null };
  }

  return changes;
}

/** Shape of the callback params Prisma passes to a `query` extension hook. */
interface QueryHookParams {
  args: { where?: unknown; [key: string]: unknown };
  query: (args: unknown) => Promise<unknown>;
}

/**
 * Build the audit query-extension applied on top of a base Prisma client.
 *
 * Returns an EXTENDED client (sharing the base client's connection/engine).
 * Modules that want automatic auditing on Role/User writes should inject the
 * `AUDITED_PRISMA` provider (see audited-prisma.ts + audit.module.ts) instead
 * of PrismaService and perform their writes through it.
 *
 * @param basePrisma the plain (unextended) Prisma client — used both to run the
 *   "before" read and as the client we extend.
 * @param audit      the AuditService used to persist entries (uses its own
 *   unextended client, so audit writes never recurse into this extension).
 * @param cls        request-scoped context carrying the acting user/company.
 */
export function createAuditExtension(
  basePrisma: PrismaClient,
  audit: AuditService,
  cls: ClsService,
) {
  const logger = new Logger('AuditExtension');

  async function record(
    model: string,
    operation: 'updated' | 'deleted',
    entityId: string,
    entityCompanyId: string | undefined,
    changes: Record<string, unknown>,
  ): Promise<void> {
    try {
      const companyId = entityCompanyId ?? cls.get<string | undefined>(CLS_COMPANY_ID);
      if (!companyId) {
        logger.warn(
          `Skipping audit for ${model}.${operation} ${entityId}: no companyId on row or in CLS context`,
        );
        return;
      }

      await audit.log({
        companyId,
        userId: cls.get<string | undefined>(CLS_USER_ID) ?? null,
        action: `${model}.${operation}`,
        entityType: model,
        entityId,
        changes,
      });
    } catch (err) {
      // Auditing must never break the underlying business write.
      logger.warn(
        `Failed to write audit entry for ${model}.${operation} ${entityId}: ${(err as Error).message}`,
      );
    }
  }

  // Build `{ role: { update, delete }, user: { update, delete }, ... }` from
  // AUDITABLE_MODELS. Prisma's per-model query-hook generics cannot be
  // satisfied by a dynamically-built map, so the assembled object is cast at
  // the $extends boundary; each hook body is individually typed via
  // QueryHookParams.
  const query: Record<string, unknown> = {};

  for (const model of AUDITABLE_MODELS) {
    const delegate = delegateName(model);

    query[delegate] = {
      async update({ args, query: run }: QueryHookParams): Promise<unknown> {
        // Read the prior row before the write so we can diff.
        let before: Row | null = null;
        try {
          // Dynamic delegate access: the model name comes from AUDITABLE_MODELS.
          before = (await (basePrisma as Record<string, any>)[delegate].findUnique({
            where: args.where,
          })) as Row | null;
        } catch (err) {
          logger.warn(
            `Audit before-read failed for ${model}.update: ${(err as Error).message}`,
          );
        }

        const after = (await run(args)) as Row;

        if (before) {
          const diff = shallowDiff(before, after);
          if (Object.keys(diff).length > 0) {
            await record(
              model,
              'updated',
              after.id,
              (after.companyId ?? before.companyId) as string | undefined,
              diff,
            );
          }
        }

        return after;
      },

      async delete({ args, query: run }: QueryHookParams): Promise<unknown> {
        // The delete result carries the full deleted row — snapshot it directly.
        const deleted = (await run(args)) as Row;
        await record(
          model,
          'deleted',
          deleted.id,
          deleted.companyId as string | undefined,
          snapshot(deleted),
        );
        return deleted;
      },
    };
  }

  return basePrisma.$extends({
    name: 'audit',
    query: query as never,
  });
}
