import { z } from 'zod';
import { paginationQuerySchema } from '@erp/contracts';

/**
 * Zod schemas for the Finance REST API request bodies / query strings.
 *
 * Colocated here (not in `@erp/contracts`) following the Inventory/Workflow
 * modules' convention: these are API-input shapes specific to these
 * endpoints, i.e. the validation boundary for what a client may POST/PATCH/
 * GET — not cross-app DTOs. Response DTO shapes live next to the service that
 * builds them (see invoices.service.ts).
 */

// --- Invoices ------------------------------------------------------------

/**
 * An Invoice is created by picking an existing SalesOrder that doesn't have
 * one yet (1:1 via `Invoice.salesOrderId @unique`) — there is no freeform
 * "create an invoice" input beyond which order it's for. `invoiceNumber` is
 * server-generated and `totalAmount` is copied from the order.
 */
export const createInvoiceSchema = z.object({
  salesOrderId: z.string().trim().min(1),
});

/** PATCH body: only the status transition is editable post-creation. */
export const updateInvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid']),
});

export const invoiceListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'sent', 'paid']).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
