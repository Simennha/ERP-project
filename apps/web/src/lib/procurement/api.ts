import { API_BASE_URL } from '@/lib/auth/api-client';

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
 * them, so the web app stays decoupled from server internals. TODO: promote
 * these to `@erp/contracts` once more modules share DTOs.
 */

// --- Shared shapes -----------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  createdAt: string;
  updatedAt: string;
}

// --- Request payloads --------------------------------------------------------

export interface PurchaseOrderInput {
  poNumber: string;
  vendorName: string;
  status?: string;
  totalAmount: number;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
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

// --- Purchase orders -----------------------------------------------------------

export function listPurchaseOrders(
  token: string | null,
  params: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<PurchaseOrderDto>> {
  return authedFetch(token, `/procurement/purchase-orders${buildQuery(params)}`);
}

export function getPurchaseOrder(token: string | null, id: string): Promise<PurchaseOrderDto> {
  return authedFetch(token, `/procurement/purchase-orders/${id}`);
}

export function createPurchaseOrder(
  token: string | null,
  input: PurchaseOrderInput,
): Promise<PurchaseOrderDto> {
  return authedFetch(token, '/procurement/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePurchaseOrder(
  token: string | null,
  id: string,
  input: Partial<PurchaseOrderInput>,
): Promise<PurchaseOrderDto> {
  return authedFetch(token, `/procurement/purchase-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deletePurchaseOrder(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/procurement/purchase-orders/${id}`, { method: 'DELETE' });
}
