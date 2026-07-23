import { z } from 'zod';
import { paginationQuerySchema } from '@erp/contracts';

/**
 * Zod schemas for the Procurement REST API request bodies / query strings.
 *
 * Colocated here (not in `@erp/contracts`) following the Inventory module's
 * convention: these are API-input shapes specific to these endpoints, i.e. the
 * validation boundary for what a client may POST/PATCH/GET — not cross-app
 * DTOs. Response DTO shapes live next to the services that build them.
 */

// totalAmount maps to Prisma `Decimal @db.Decimal(12, 2)`: max 10 integer
// digits + 2 decimal places -> largest representable value is
// 9_999_999_999.99. Validate against that ceiling so an out-of-range amount is
// a clean 400 rather than a database write error. Amounts are non-negative.
const MAX_DECIMAL_12_2 = 9_999_999_999.99;

const priceSchema = z
  .number({ invalid_type_error: 'must be a number' })
  .nonnegative('must be zero or greater')
  .max(MAX_DECIMAL_12_2, 'exceeds the maximum allowed price');

// --- Purchase orders -----------------------------------------------------------

const purchaseOrderStatusSchema = z.enum(['draft', 'submitted', 'received', 'cancelled']);

export const createPurchaseOrderSchema = z.object({
  poNumber: z.string().trim().min(1).max(64),
  vendorName: z.string().trim().min(1).max(200),
  status: purchaseOrderStatusSchema.optional(),
  totalAmount: priceSchema,
  orderDate: z.coerce.date().optional(),
  expectedDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** PATCH body: every field optional (partial update). */
export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

export const purchaseOrderListQuerySchema = paginationQuerySchema.extend({
  status: purchaseOrderStatusSchema.optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;
