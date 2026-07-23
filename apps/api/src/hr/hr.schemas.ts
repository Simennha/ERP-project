import { z } from 'zod';
import { paginationQuerySchema } from '@erp/contracts';

/**
 * Zod schemas for the HR REST API request bodies / query strings.
 *
 * Colocated here (not in `@erp/contracts`) following the inventory module's
 * convention: these are API-input shapes specific to these endpoints, i.e.
 * the validation boundary for what a client may POST/PATCH/GET — not
 * cross-app DTOs. Response DTO shapes live next to the services that build
 * them (see employees.service.ts).
 */

// --- Employees -----------------------------------------------------------------

export const employmentStatusSchema = z.enum(['active', 'onLeave', 'terminated']);

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  jobTitle: z.string().trim().max(200).optional(),
  department: z.string().trim().max(100).optional(),
  employmentStatus: employmentStatusSchema.optional(),
  hireDate: z.coerce.date().optional(),
});

/** PATCH body: every field optional (partial update). */
export const updateEmployeeSchema = createEmployeeSchema.partial();

export const employeeListQuerySchema = paginationQuerySchema.extend({
  employmentStatus: employmentStatusSchema.optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
