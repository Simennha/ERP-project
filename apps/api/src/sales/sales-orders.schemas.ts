import { z } from 'zod';
import { paginationQuerySchema } from '@erp/contracts';

/**
 * Zod request schemas for the Sales Orders API. Colocated (see the note in
 * customers.schemas.ts). Money values (`unitPrice`) arrive as JSON numbers and
 * are converted to Prisma Decimal in the service; `lineTotal`/`totalAmount` are
 * never accepted from the client — they are always recomputed server-side.
 */

/** One order line as submitted by the client. */
export const salesOrderLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Editable unit price (frontend pre-fills from the product's salePrice). */
  unitPrice: z.number().nonnegative().finite(),
});

export const createSalesOrderSchema = z.object({
  customerId: z.string().min(1),
  lines: z.array(salesOrderLineSchema).min(1),
});

/**
 * PATCH body. `customerId` and/or `lines` may be sent. When `lines` is present
 * the whole line list is replaced and totals recomputed; when absent the lines
 * and total are left untouched. Only allowed while the order is still 'draft'
 * (enforced in the service — 409 otherwise).
 */
export const updateSalesOrderSchema = z
  .object({
    customerId: z.string().min(1).optional(),
    lines: z.array(salesOrderLineSchema).min(1).optional(),
  })
  .refine((v) => v.customerId !== undefined || v.lines !== undefined, {
    message: 'Provide at least one of customerId or lines to update',
  });

/** `GET /sales/orders?status=&page=&pageSize=` */
export const listSalesOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'confirmed', 'fulfilled', 'cancelled']).optional(),
});

/** `GET /sales/availability?productId=&warehouseId=` (warehouseId optional). */
export const availabilityQuerySchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1).optional(),
});

export type SalesOrderLineInput = z.infer<typeof salesOrderLineSchema>;
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
export type ListSalesOrdersQuery = z.infer<typeof listSalesOrdersQuerySchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
