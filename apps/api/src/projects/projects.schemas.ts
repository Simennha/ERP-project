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

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(32),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  description: z.string().trim().max(2000).optional(),
});

/** PATCH body: every field optional (partial update). */
export const updateProjectSchema = createProjectSchema.partial();

export const projectListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PROJECT_STATUSES).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
