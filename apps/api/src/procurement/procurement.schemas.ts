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

// unitCost/totalAmount map to Prisma `Decimal @db.Decimal(12, 2)`: max 10
// integer digits + 2 decimal places -> largest representable value is
// 9_999_999_999.99. Validate against that ceiling so an out-of-range amount is
// a clean 400 rather than a database write error. Amounts are non-negative.
const MAX_DECIMAL_12_2 = 9_999_999_999.99;

const priceSchema = z
  .number({ invalid_type_error: 'must be a number' })
  .nonnegative('must be zero or greater')
  .max(MAX_DECIMAL_12_2, 'exceeds the maximum allowed price');

// --- Purchase orders -----------------------------------------------------------

const purchaseOrderStatusSchema = z.enum([
  'draft',
  'submitted',
  'partiallyReceived',
  'received',
  'cancelled',
]);

/** One PO line as submitted by the client — mirrors salesOrderLineSchema. */
export const purchaseOrderLineSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantityOrdered: z.number().int().positive(),
  /** Editable unit cost (frontend pre-fills from the product's costPrice). */
  unitCost: priceSchema,
});

const purchaseOrderFieldsSchema = z.object({
  poNumber: z.string().trim().min(1).max(64),
  vendorName: z.string().trim().min(1).max(200),
  orderDate: z.coerce.date().optional(),
  expectedDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});

// Reject an expectedDate before orderDate when both are present. Duplicated
// (not a shared generic helper) — a generic constraint tight enough to
// type-check `.refine()`'s callback ends up narrowing the inferred output to
// just {orderDate, expectedDate}, breaking every other field's type on the
// resulting schema.
export const createPurchaseOrderSchema = purchaseOrderFieldsSchema
  .extend({ lines: z.array(purchaseOrderLineSchema).min(1) })
  .refine((v) => !v.orderDate || !v.expectedDate || v.expectedDate >= v.orderDate, {
    message: 'expectedDate cannot be before orderDate',
    path: ['expectedDate'],
  });

/**
 * PATCH body: every header field optional (partial update); `lines`, if
 * present, fully replaces the line list (same "full-replace" semantics as
 * `updateSalesOrderSchema`). Only allowed while the PO is still 'draft'
 * (enforced in the service — 409 otherwise). `status` is never accepted here
 * — transitions go through the dedicated submit/receive/cancel actions.
 */
export const updatePurchaseOrderSchema = purchaseOrderFieldsSchema
  .partial()
  .extend({ lines: z.array(purchaseOrderLineSchema).min(1).optional() })
  .refine((v) => !v.orderDate || !v.expectedDate || v.expectedDate >= v.orderDate, {
    message: 'expectedDate cannot be before orderDate',
    path: ['expectedDate'],
  });

/**
 * POST .../receive body: one entry per line being (partially or fully)
 * received in this call. Omitted lines are left untouched — a receive() call
 * doesn't have to cover every remaining line at once.
 */
export const receivePurchaseOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        quantityReceived: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const purchaseOrderListQuerySchema = paginationQuerySchema.extend({
  status: purchaseOrderStatusSchema.optional(),
});

export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;
