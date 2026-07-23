import { z } from 'zod';
import { paginationQuerySchema } from '@erp/contracts';

/**
 * Zod schemas for the Inventory REST API request bodies / query strings.
 *
 * Colocated here (not in `@erp/contracts`) following the workflow module's
 * convention: these are API-input shapes specific to these endpoints, i.e. the
 * validation boundary for what a client may POST/PATCH/GET — not cross-app
 * DTOs. Response DTO shapes live next to the services that build them.
 */

// Prices map to Prisma `Decimal @db.Decimal(12, 2)`: max 10 integer digits + 2
// decimal places -> largest representable value is 9_999_999_999.99. Validate
// against that ceiling so an out-of-range price is a clean 400 rather than a
// database write error. Prices are non-negative.
const MAX_DECIMAL_12_2 = 9_999_999_999.99;

const priceSchema = z
  .number({ invalid_type_error: 'must be a number' })
  .nonnegative('must be zero or greater')
  .max(MAX_DECIMAL_12_2, 'exceeds the maximum allowed price');

/** Query-string boolean: accepts true/false/1/0; anything else is a 400. */
const booleanQueryParam = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

// --- Products ----------------------------------------------------------------

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  // Omit to let the DB default ("each") apply.
  uom: z.string().trim().min(1).max(32).optional(),
  costPrice: priceSchema,
  salePrice: priceSchema,
  category: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

/** PATCH body: every field optional (partial update). */
export const updateProductSchema = createProductSchema.partial();

export const productListQuerySchema = paginationQuerySchema.extend({
  category: z.string().trim().min(1).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// --- Warehouses --------------------------------------------------------------

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(32),
  address: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const warehouseListQuerySchema = paginationQuerySchema;

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

// --- Stock -------------------------------------------------------------------

/**
 * `GET /inventory/stock` filters. `warehouseId` and `lowStock` are the
 * deliberately greppable, obvious names a later dashboard phase links to when
 * drilling down into low-stock rows.
 */
export const stockListQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.string().trim().min(1).optional(),
  lowStock: booleanQueryParam.optional(),
});

export const stockMovementsQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.string().trim().min(1).optional(),
});

/**
 * `POST /inventory/stock/adjust` body. `delta` is a signed, non-zero integer
 * applied to quantityOnHand (positive = stock in, negative = write-off/out).
 */
export const stockAdjustSchema = z.object({
  productId: z.string().trim().min(1),
  warehouseId: z.string().trim().min(1),
  delta: z
    .number({ invalid_type_error: 'must be a number' })
    .int('must be a whole number')
    .refine((n) => n !== 0, 'delta must be a non-zero integer'),
  reason: z.string().trim().max(500).optional(),
});

export type StockListQuery = z.infer<typeof stockListQuerySchema>;
export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>;
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
