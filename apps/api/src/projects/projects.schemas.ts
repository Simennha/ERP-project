import { z } from 'zod';
import { paginationQuerySchema } from '@erp/contracts';

/**
 * Zod schemas for the Projects REST API request bodies / query strings.
 *
 * Colocated here (not in `@erp/contracts`) following the inventory/workflow
 * modules' convention: these are API-input shapes specific to these
 * endpoints, i.e. the validation boundary for what a client may POST/PATCH —
 * not cross-app DTOs. Response DTO shapes live next to the service that
 * builds them (projects.service.ts).
 */

const PROJECT_STATUSES = ['planned', 'active', 'onHold', 'completed', 'cancelled'] as const;

const projectFieldsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(32),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  description: z.string().trim().max(2000).optional(),
});

// Reject an endDate before startDate when both are present. Duplicated (not
// a shared generic helper) — a generic constraint tight enough to type-check
// `.refine()`'s callback (e.g. `T extends z.ZodType<{startDate?, endDate?}>`)
// ends up narrowing the inferred output to just those two fields, breaking
// every other field's type on the resulting schema.
export const createProjectSchema = projectFieldsSchema.refine(
  (v) => !v.startDate || !v.endDate || v.endDate >= v.startDate,
  { message: 'endDate cannot be before startDate', path: ['endDate'] },
);

/** PATCH body: every field optional (partial update). */
export const updateProjectSchema = projectFieldsSchema.partial().refine(
  (v) => !v.startDate || !v.endDate || v.endDate >= v.startDate,
  { message: 'endDate cannot be before startDate', path: ['endDate'] },
);

export const projectListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PROJECT_STATUSES).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
