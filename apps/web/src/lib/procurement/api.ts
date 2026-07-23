import { authedFetch } from '@/lib/auth/api-client';

/**
 * Typed client for the Procurement REST API.
 *
 * Copies the fetch pattern from lib/auth/api-client.ts (JSON, `credentials:
 * 'include'`, normalized error message) and adds the `Authorization: Bearer`
 * header for these protected, non-auth endpoints. Every function takes the
 * access token explicitly — read it from `useAuth().getAccessToken()` at call
 * time.
 *
 * NOTE: the response shapes below intentionally mirror the API's inline DTOs
 * (apps/api/src/procurement/purchase-orders.service.ts) rather than importing
 * them, so the web app stays decoupled from server internals. Product/
 * Warehouse pickers reuse `@/lib/inventory/api` directly rather than
 * duplicating that client, since Procurement has no reason to diverge from
 * Inventory's own DTOs for those.
 */

// --- Shared shapes -----------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** unitCost/lineTotal arrive as fixed 2dp strings, e.g. "10.00". */
export interface PurchaseOrderLineDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: string;
  lineTotal: string;
}

/** `totalAmount` arrives as a fixed 2dp string, e.g. "10.00". */
export interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  totalAmount: string;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  lines: PurchaseOrderLineDto[];
  createdAt: string;
  updatedAt: string;
}

/** List rows omit `lines` (matches the API's list DTO — detail only). */
export interface PurchaseOrderListItemDto {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  totalAmount: string;
  orderDate: string;
  expectedDate: string | null;
  createdAt: string;
}

// --- Request payloads --------------------------------------------------------

export interface PurchaseOrderLineInput {
  productId: string;
  warehouseId: string;
  quantityOrdered: number;
  unitCost: number;
}

export interface CreatePurchaseOrderInput {
  poNumber: string;
  vendorName: string;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  lines: PurchaseOrderLineInput[];
}

export type UpdatePurchaseOrderInput = Partial<CreatePurchaseOrderInput>;

export interface ReceivePurchaseOrderInput {
  lines: Array<{ lineId: string; quantityReceived: number }>;
}

// --- Fetch plumbing ----------------------------------------------------------

// authedFetch is shared (lib/auth/api-client.ts) — handles the fetch pattern
// below plus a silent 401 -> refresh -> retry recovery.

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// --- Purchase orders -----------------------------------------------------------

export function listPurchaseOrders(
  token: string | null,
  params: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<PurchaseOrderListItemDto>> {
  return authedFetch(token, `/procurement/purchase-orders${buildQuery(params)}`);
}

export function getPurchaseOrder(token: string | null, id: string): Promise<PurchaseOrderDto> {
  return authedFetch(token, `/procurement/purchase-orders/${id}`);
}

export function createPurchaseOrder(
  token: string | null,
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrderDto> {
  return authedFetch(token, '/procurement/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePurchaseOrder(
  token: string | null,
  id: string,
  input: UpdatePurchaseOrderInput,
): Promise<PurchaseOrderDto> {
  return authedFetch(token, `/procurement/purchase-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deletePurchaseOrder(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/procurement/purchase-orders/${id}`, { method: 'DELETE' });
}

/** Send a draft PO to the vendor: draft -> submitted. */
export function submitPurchaseOrder(token: string | null, id: string): Promise<PurchaseOrderDto> {
  return authedFetch(token, `/procurement/purchase-orders/${id}/submit`, { method: 'POST' });
}

/** Receive goods against one or more lines (partial or full); adjusts real stock. */
export function receivePurchaseOrder(
  token: string | null,
  id: string,
  input: ReceivePurchaseOrderInput,
): Promise<PurchaseOrderDto> {
  return authedFetch(token, `/procurement/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Cancel a draft or submitted PO; not reachable once any goods have been received. */
export function cancelPurchaseOrder(token: string | null, id: string): Promise<PurchaseOrderDto> {
  return authedFetch(token, `/procurement/purchase-orders/${id}/cancel`, { method: 'POST' });
}
