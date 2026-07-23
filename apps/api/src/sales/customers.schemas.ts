import { z } from 'zod';

/**
 * Zod request-body schemas for the Customers CRUD API. Colocated here (not in
 * @erp/contracts) following the same convention as workflow.schemas.ts: these
 * are API-input shapes specific to these endpoints, validated at the parameter
 * level by ZodValidationPipe.
 */

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  billingAddress: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

/** PATCH body: every field optional; omitted fields are left unchanged. */
export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
