/**
 * Input shape for AuditService.log() (apps/api/src/core/audit).
 *
 * Two write paths use this same shape: explicit `auditService.log(...)` calls
 * at meaningful business transitions ("Order confirmed"), and a Prisma Client
 * Extension that auto-diffs before/after state on models tagged auditable.
 */
export interface AuditLogInput {
  companyId: string;
  userId?: string | null;
  /** Human-readable action, e.g. "sales_order.confirmed", "role.permissions_updated". */
  action: string;
  /** Prisma model name, e.g. "SalesOrder". */
  entityType: string;
  entityId: string;
  /** Field-level before/after diff, or any other structured detail. */
  changes?: Record<string, unknown> | null;
  ip?: string | null;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  userId: string | null;
  createdAt: string;
}
