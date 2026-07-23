import type { Prisma, Customer } from '@erp/database';

/**
 * Client-facing DTO shapes for the Sales module + the mappers that build them
 * from Prisma rows.
 *
 * ── Decimal handling (IMPORTANT) ─────────────────────────────────────────────
 * Money columns (unitPrice, lineTotal, totalAmount) are Prisma Decimal, which
 * at runtime are Decimal.js objects — NOT plain numbers. If they were returned
 * raw, JSON serialization is lossy/implementation-defined. So every mapper here
 * explicitly calls `.toString()` on each money field, yielding a stable decimal
 * STRING (e.g. "1234.50") in every response body. The same discipline is
 * applied to the SALES_ORDER_CREATED event payload in SalesOrdersService.
 *
 * Dates are returned as ISO-8601 strings for the same "no implicit
 * serialization" reason.
 */

// --- Prisma include shapes (single source of truth for service + mapper) -----

export const SALES_ORDER_DETAIL_INCLUDE = {
  customer: true,
  lines: {
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.SalesOrderInclude;

export const SALES_ORDER_LIST_INCLUDE = {
  customer: { select: { name: true } },
} satisfies Prisma.SalesOrderInclude;

type SalesOrderDetailRow = Prisma.SalesOrderGetPayload<{
  include: typeof SALES_ORDER_DETAIL_INCLUDE;
}>;

type SalesOrderListRow = Prisma.SalesOrderGetPayload<{
  include: typeof SALES_ORDER_LIST_INCLUDE;
}>;

// --- DTO interfaces ----------------------------------------------------------

export interface CustomerDto {
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

export interface SalesOrderLineDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  /** Decimal, stringified (e.g. "9.99"). */
  unitPrice: string;
  /** Decimal, stringified (e.g. "99.90"). */
  lineTotal: string;
}

export interface SalesOrderCustomerDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface SalesOrderDetailDto {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  customer: SalesOrderCustomerDto | null;
  orderDate: string;
  /** Decimal, stringified. */
  totalAmount: string;
  lines: SalesOrderLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderListItemDto {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  customerName: string | null;
  orderDate: string;
  /** Decimal, stringified. */
  totalAmount: string;
  createdAt: string;
}

export interface AvailabilityDto {
  productId: string;
  /** null when the company has no warehouse configured yet. */
  warehouseId: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
  reorderPoint: number;
}

// --- Mappers -----------------------------------------------------------------

export function toCustomerDto(c: Customer): CustomerDto {
  return {
    id: c.id,
    companyId: c.companyId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    billingAddress: c.billingAddress,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toSalesOrderDetailDto(order: SalesOrderDetailRow): SalesOrderDetailDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerId: order.customerId,
    customer: order.customer
      ? {
          id: order.customer.id,
          name: order.customer.name,
          email: order.customer.email,
          phone: order.customer.phone,
        }
      : null,
    orderDate: order.orderDate.toISOString(),
    totalAmount: order.totalAmount.toString(),
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.product?.name ?? '',
      productSku: line.product?.sku ?? '',
      quantity: line.quantity,
      unitPrice: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function toSalesOrderListItemDto(order: SalesOrderListRow): SalesOrderListItemDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerId: order.customerId,
    customerName: order.customer?.name ?? null,
    orderDate: order.orderDate.toISOString(),
    totalAmount: order.totalAmount.toString(),
    createdAt: order.createdAt.toISOString(),
  };
}
