import { API_BASE_URL } from '@/lib/auth/api-client';

/**
 * Typed client for the Inventory REST API.
 *
 * Copies the fetch pattern from lib/auth/api-client.ts (JSON, `credentials:
 * 'include'`, normalized error message) and adds the `Authorization: Bearer`
 * header for these protected, non-auth endpoints. Every function takes the
 * access token explicitly — read it from `useAuth().getAccessToken()` at call
 * time.
 *
 * NOTE: the response shapes below intentionally mirror the API's inline DTOs
 * (apps/api/src/inventory/*.service.ts) rather than importing them, so the web
 * app stays decoupled from server internals. TODO: promote these to
 * `@erp/contracts` once Sales/Inventory share more DTOs.
 */

// --- Shared shapes -----------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Money fields (costPrice/salePrice) arrive as fixed 2dp strings, e.g. "10.00". */
export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  uom: string;
  costPrice: string;
  salePrice: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseDto {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItemDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
  reorderPoint: number;
  reorderQty: number;
  isLow: boolean;
  updatedAt: string;
}

export interface StockMovementDto {
  id: string;
  productId: string;
  warehouseId: string;
  warehouseName: string;
  type: string;
  quantity: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface StockAdjustResult {
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
}

// --- Request payloads --------------------------------------------------------

export interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  uom?: string;
  costPrice: number;
  salePrice: number;
  category?: string;
  isActive?: boolean;
}

export interface WarehouseInput {
  name: string;
  code: string;
  address?: string;
  isActive?: boolean;
}

export interface StockAdjustInput {
  productId: string;
  warehouseId: string;
  delta: number;
  reason?: string;
}

// --- Fetch plumbing ----------------------------------------------------------

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.join(', ');
      }
    }
  } catch {
    // Non-JSON error body — fall through to the status text.
  }
  return `Request failed (${res.status})`;
}

async function authedFetch<T>(
  token: string | null,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!token) {
    throw new Error('Not authenticated');
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

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

// --- Products ----------------------------------------------------------------

export function listProducts(
  token: string | null,
  params: { category?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<ProductDto>> {
  return authedFetch(token, `/inventory/products${buildQuery(params)}`);
}

export function getProduct(token: string | null, id: string): Promise<ProductDto> {
  return authedFetch(token, `/inventory/products/${id}`);
}

export function createProduct(token: string | null, input: ProductInput): Promise<ProductDto> {
  return authedFetch(token, '/inventory/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProduct(
  token: string | null,
  id: string,
  input: Partial<ProductInput>,
): Promise<ProductDto> {
  return authedFetch(token, `/inventory/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProduct(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/inventory/products/${id}`, { method: 'DELETE' });
}

// --- Warehouses --------------------------------------------------------------

export function listWarehouses(
  token: string | null,
  params: { page?: number; pageSize?: number } = {},
): Promise<Paginated<WarehouseDto>> {
  return authedFetch(token, `/inventory/warehouses${buildQuery(params)}`);
}

export function getWarehouse(token: string | null, id: string): Promise<WarehouseDto> {
  return authedFetch(token, `/inventory/warehouses/${id}`);
}

export function createWarehouse(
  token: string | null,
  input: WarehouseInput,
): Promise<WarehouseDto> {
  return authedFetch(token, '/inventory/warehouses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWarehouse(
  token: string | null,
  id: string,
  input: Partial<WarehouseInput>,
): Promise<WarehouseDto> {
  return authedFetch(token, `/inventory/warehouses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteWarehouse(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/inventory/warehouses/${id}`, { method: 'DELETE' });
}

// --- Stock -------------------------------------------------------------------

export function listStock(
  token: string | null,
  params: { warehouseId?: string; lowStock?: boolean; page?: number; pageSize?: number } = {},
): Promise<Paginated<StockItemDto>> {
  return authedFetch(token, `/inventory/stock${buildQuery(params)}`);
}

export function adjustStock(
  token: string | null,
  input: StockAdjustInput,
): Promise<StockAdjustResult> {
  return authedFetch(token, '/inventory/stock/adjust', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listMovements(
  token: string | null,
  productId: string,
  params: { warehouseId?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<StockMovementDto>> {
  return authedFetch(token, `/inventory/stock/${productId}/movements${buildQuery(params)}`);
}
