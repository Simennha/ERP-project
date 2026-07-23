import type { createAuditExtension } from './audit.extension';

/**
 * DI token for the audit-extended Prisma client.
 *
 * Inject this (instead of PrismaService) in modules that want automatic
 * before/after audit entries on writes to auditable models (see
 * AUDITABLE_MODELS in audit.extension.ts):
 *
 *   constructor(@Inject(AUDITED_PRISMA) private readonly prisma: AuditedPrismaClient) {}
 *
 * The token resolves to a Prisma client that shares PrismaService's connection
 * but has the audit `query` extension applied. It is provided/exported by
 * AuditModule.
 */
export const AUDITED_PRISMA = Symbol('AUDITED_PRISMA');

/** The concrete type of the audit-extended client. */
export type AuditedPrismaClient = ReturnType<typeof createAuditExtension>;
