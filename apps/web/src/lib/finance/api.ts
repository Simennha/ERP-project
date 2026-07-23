import { API_BASE_URL } from '@/lib/auth/api-client';

/**
 * Typed client for the Finance REST API.
 *
 * Copies the fetch pattern from lib/auth/api-client.ts (JSON, `credentials:
 * 'include'`, normalized error message) and adds the `Authorization: Bearer`
 * header for these protected, non-auth endpoints. Every function takes the
 * access token explicitly — read it from `useAuth().getAccessToken()` at call
 * time.
 *
 * NOTE: the response shapes below intentionally mirror the API's inline DTOs
 * (apps/api/src/finance/invoices.service.ts) rather than importing them, so
 * the web app stays decoupled from server internals — same convention as
 * lib/inventory/api.ts.
 */

// --- Shared shapes -----------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** `status`: 'draft' | 'sent' | 'paid'. `totalAmount` is a fixed 2dp string, e.g. "1234.50". */
export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
}

/** A SalesOrder eligible to be invoiced (no linked invoice yet). */
export interface AvailableSalesOrderDto {
  id: string;
  orderNumber: string;
  totalAmount: string;
  customerName: string;
}

// --- Request payloads --------------------------------------------------------

export interface CreateInvoiceInput {
  salesOrderId: string;
}

export interface UpdateInvoiceInput {
  status: 'draft' | 'sent' | 'paid';
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

// --- Invoices ------------------------------------------------------------

export function listInvoices(
  token: string | null,
  params: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<InvoiceDto>> {
  return authedFetch(token, `/finance/invoices${buildQuery(params)}`);
}

export function getInvoice(token: string | null, id: string): Promise<InvoiceDto> {
  return authedFetch(token, `/finance/invoices/${id}`);
}

export function listAvailableSalesOrders(
  token: string | null,
): Promise<AvailableSalesOrderDto[]> {
  return authedFetch(token, '/finance/invoices/available-orders');
}

export function createInvoice(
  token: string | null,
  input: CreateInvoiceInput,
): Promise<InvoiceDto> {
  return authedFetch(token, '/finance/invoices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateInvoice(
  token: string | null,
  id: string,
  input: UpdateInvoiceInput,
): Promise<InvoiceDto> {
  return authedFetch(token, `/finance/invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteInvoice(token: string | null, id: string): Promise<void> {
  return authedFetch(token, `/finance/invoices/${id}`, { method: 'DELETE' });
}
