import { z } from 'zod';
import { paginationQuerySchema } from '@erp/contracts';

/**
 * Query params for `GET /audit-log`. Extends the shared pagination schema
 * (`page`, `pageSize`) from @erp/contracts with optional entity filters.
 * Unknown keys are stripped by zod.
 */
export const auditLogQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
