import { Injectable } from '@nestjs/common';
import { Prisma, type AuditLog } from '@erp/database';
import type { AuditLogDto, AuditLogInput } from '@erp/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/** Parameters for the paginated audit-log read (see AuditController). */
export interface AuditLogListParams {
  companyId: string;
  entityType?: string;
  entityId?: string;
  page: number;
  pageSize: number;
}

/**
 * Generic audit logging.
 *
 * Two write paths feed the append-only `AuditLog` table, both through `log()`:
 *  1. Explicit calls at meaningful business transitions, made by other services
 *     in later phases, e.g.
 *       auditService.log({ companyId, userId, action: 'sales_order.confirmed',
 *                          entityType: 'SalesOrder', entityId, changes: {...} });
 *  2. The automatic before/after diff extension (see audit.extension.ts), which
 *     calls `log()` for update/delete on models tagged auditable.
 *
 * This service intentionally uses the plain (unextended) PrismaService so that
 * writing an audit entry can never re-trigger the audit extension.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Append a single audit entry. Maps the contract `changes` -> DB `changesJson`. */
  async log(input: AuditLogInput): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      companyId: input.companyId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ip: input.ip ?? null,
      // Only set the Json column when we actually have a payload; a nullable
      // Json field left undefined is stored as NULL. (`as unknown as` because
      // a loose Record does not structurally match Prisma's InputJsonValue.)
      ...(input.changes != null
        ? { changesJson: input.changes as unknown as Prisma.InputJsonValue }
        : {}),
    };

    await this.prisma.auditLog.create({ data });
  }

  /**
   * Read audit entries for the caller's company, most recent first, filtered
   * optionally by entityType/entityId and paginated. Returns client DTOs.
   */
  async list(params: AuditLogListParams): Promise<AuditLogDto[]> {
    const { companyId, entityType, entityId, page, pageSize } = params;

    const rows = await this.prisma.auditLog.findMany({
      where: {
        companyId,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return rows.map(toAuditLogDto);
  }
}

/** Map a DB `AuditLog` row to the client `AuditLogDto` shape. */
export function toAuditLogDto(row: AuditLog): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    changes:
      row.changesJson == null
        ? null
        : (row.changesJson as unknown as Record<string, unknown>),
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}
