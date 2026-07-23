import { API_BASE_URL } from '../auth/api-client';

/**
 * Sales feature API client. Mirrors the functional style of lib/auth/api-client
 * but for the authenticated Sales endpoints. Every call takes the current
 * access token (obtained from `useAuth().getAccessToken()`) and sends it as a
 * Bearer header, matching the API's JWT strategy.
 *
 * Money fields come back from the API as decimal STRINGS (the backend
 * stringifies every Prisma Decimal) — they are kept as strings here and only
 * parsed with `Number(...)` for display/summation in the UI.
 */

// --- Response types (mirror apps/api/src/sales/sales.dto.ts) -----------------

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  customerName: string | null;
  orderDate: string;
  totalAmount: string;
  createdAt: string;
}

export interface SalesOrderLine {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface SalesOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  orderDate: string;
  totalAmount: string;
  lines: SalesOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  productId: string;
  warehouseId: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
  reorderPoint: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A product option for the order-builder picker (see listProducts). */
export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  /** Decimal string; used to pre-fill the line unit price. */
  salePrice: string;
}

// --- Request bodies ----------------------------------------------------------

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  isActive?: boolean;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
  customerId: string;
  lines: OrderLineInput[];
}

// --- Core fetch --------------------------------------------------------------

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
  } catch {
    // Non-JSON error body — fall through.
  }
  return `Request failed (${res.status})`;
}

async function salesFetch<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// --- Customers ---------------------------------------------------------------

export function listCustomers(token: string | null): Promise<Customer[]> {
  return salesFetch<Customer[]>('/sales/customers', token);
}

export function getCustomer(token: string | null, id: string): Promise<Customer> {
  return salesFetch<Customer>(`/sales/customers/${id}`, token);
}

export function createCustomer(
  token: string | null,
  input: CustomerInput,
): Promise<Customer> {
  return salesFetch<Customer>('/sales/customers', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// --- Sales orders ------------------------------------------------------------

export function listOrders(
  token: string | null,
  params: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<SalesOrderListItem>> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return salesFetch<Paginated<SalesOrderListItem>>(
    `/sales/orders${qs ? `?${qs}` : ''}`,
    token,
  );
}

export function getOrder(token: string | null, id: string): Promise<SalesOrderDetail> {
  return salesFetch<SalesOrderDetail>(`/sales/orders/${id}`, token);
}

export function createOrder(
  token: string | null,
  input: CreateOrderInput,
): Promise<SalesOrderDetail> {
  return salesFetch<SalesOrderDetail>('/sales/orders', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Reserve stock for every line and transition draft -> confirmed. */
export function confirmOrder(token: string | null, id: string): Promise<SalesOrderDetail> {
  return salesFetch<SalesOrderDetail>(`/sales/orders/${id}/confirm`, token, {
    method: 'POST',
  });
}

/** Commit each line's reservation to an actual deduction; confirmed -> fulfilled. */
export function fulfillOrder(token: string | null, id: string): Promise<SalesOrderDetail> {
  return salesFetch<SalesOrderDetail>(`/sales/orders/${id}/fulfill`, token, {
    method: 'POST',
  });
}

/** Release any reserved stock (if confirmed) and cancel; draft|confirmed -> cancelled. */
export function cancelOrder(token: string | null, id: string): Promise<SalesOrderDetail> {
  return salesFetch<SalesOrderDetail>(`/sales/orders/${id}/cancel`, token, {
    method: 'POST',
  });
}

export function getAvailability(
  token: string | null,
  productId: string,
  warehouseId?: string,
): Promise<Availability> {
  const search = new URLSearchParams({ productId });
  if (warehouseId) search.set('warehouseId', warehouseId);
  return salesFetch<Availability>(`/sales/availability?${search.toString()}`, token);
}

/**
 * Product options for the order-builder picker.
 *
 * NOTE: the product catalog is owned by the Inventory module (a sibling agent's
 * REST API/UI), not by Sales. This calls the Inventory read endpoint
 * `GET /inventory/products` and tolerantly accepts either a bare array or a
 * `{ data: [...] }` pagination envelope, mapping each row defensively. If that
 * endpoint isn't available yet (Inventory not merged), it throws and the order
 * builder falls back to manual product-id + unit-price entry. The exact path /
 * shape may need reconciling once Inventory's API lands — see the report.
 */
export async function listProducts(token: string | null): Promise<ProductOption[]> {
  const raw = await salesFetch<unknown>('/inventory/products', token);
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: unknown[] }).data)
      : [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      id: String(row.id ?? ''),
      sku: String(row.sku ?? ''),
      name: String(row.name ?? ''),
      salePrice:
        row.salePrice === undefined || row.salePrice === null
          ? '0'
          : String(row.salePrice),
    }))
    .filter((option) => option.id !== '');
}
