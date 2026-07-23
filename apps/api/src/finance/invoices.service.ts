import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@erp/database';
import type { Paginated } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateInvoiceInput,
  InvoiceListQuery,
  UpdateInvoiceInput,
} from './finance.schemas';

/**
 * `invoiceNumber` generator: `INV-{YYYYMMDD}-{6 base36 chars}`. Same scheme
 * (and same non-sequential-counter rationale) as `generateOrderNumber()` in
 * `sales/sales-orders.service.ts` — a date prefix keeps the number
 * human-scannable while the random suffix makes collisions astronomically
 * unlikely; the `@@unique([companyId, invoiceNumber])` constraint on
 * `Invoice` (sales.prisma) is the backstop, surfaced below as a 409.
 */
function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, '0');
  return `INV-${y}${m}${d}-${rand}`;
}

// --- Prisma include shapes (single source of truth for service + mapper) -----

const INVOICE_INCLUDE = {
  salesOrder: { include: { customer: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

/**
 * Client-facing shape of an Invoice, enriched with the linked SalesOrder's
 * `orderNumber` and its Customer's `name` so the UI doesn't need a second
 * round trip.
 *
 * `totalAmount` is a Prisma `Decimal @db.Decimal(12,2)` — represented at
 * runtime as a Decimal.js object, not a plain number. Following the
 * Inventory/Sales convention, it's explicitly stringified (`.toFixed(2)`)
 * rather than relying on default JSON serialization (see
 * products.service.ts's ProductDto docblock for the full rationale).
 */
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

export function toInvoiceDto(row: InvoiceRow): InvoiceDto {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    salesOrderId: row.salesOrderId,
    salesOrderNumber: row.salesOrder.orderNumber,
    customerName: row.salesOrder.customer.name,
    status: row.status,
    totalAmount: row.totalAmount.toFixed(2),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A SalesOrder eligible to be invoiced (no linked Invoice yet). */
export interface AvailableSalesOrderDto {
  id: string;
  orderNumber: string;
  totalAmount: string;
  customerName: string;
}

/**
 * Invoice CRUD, built against the pre-existing `Invoice` model in
 * sales.prisma (1:1 with `SalesOrder` via `salesOrderId @unique`). Unlike a
 * freestanding entity, an Invoice is created by picking an existing
 * SalesOrder that doesn't have one yet — `invoiceNumber` is server-generated
 * and `totalAmount` is copied from the order at creation time, never freely
 * entered. Post-creation, only `status` (draft -> sent -> paid) is editable.
 *
 * Note: `SalesOrdersService.confirm()`/`fulfill()` (apps/api/src/sales/)
 * already create/transition an Invoice automatically as part of the order
 * lifecycle — this service's `create()` is a manual/explicit path for the
 * (typically still-draft) orders that lifecycle hasn't reached yet. Both
 * paths write the same table under the same 1:1 constraint, so "available
 * sales orders" always reflects the true set of not-yet-invoiced orders
 * regardless of which path got there first.
 *
 * Everything is company-scoped: reads/writes filter by the caller's
 * companyId, and a cross-company (or missing) id resolves to 404 — never
 * leaking that the record exists for another company.
 */
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    companyId: string,
    query: InvoiceListQuery,
  ): Promise<Paginated<InvoiceDto>> {
    const { status, page, pageSize } = query;
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      ...(status ? { status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: rows.map(toInvoiceDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * SalesOrders in this company with no linked Invoice yet — the candidate
   * list for `create()`. Unpaginated (capped at 100, matching the "small
   * unpaginated picker list" convention), newest order first.
   */
  async listAvailableSalesOrders(companyId: string): Promise<AvailableSalesOrderDto[]> {
    const orders = await this.prisma.salesOrder.findMany({
      where: { companyId, invoice: null },
      include: { customer: true },
      orderBy: { orderDate: 'desc' },
      take: 100,
    });
    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount.toFixed(2),
      customerName: order.customer.name,
    }));
  }

  async get(companyId: string, id: string): Promise<InvoiceDto> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: INVOICE_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return toInvoiceDto(row);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreateInvoiceInput,
  ): Promise<InvoiceDto> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: input.salesOrderId, companyId },
      select: { id: true, totalAmount: true },
    });
    if (!order) {
      throw new NotFoundException(`Sales order ${input.salesOrderId} not found`);
    }

    const invoiceNumber = generateInvoiceNumber();
    try {
      const row = await this.prisma.invoice.create({
        data: {
          companyId,
          salesOrderId: order.id,
          invoiceNumber,
          status: 'draft',
          totalAmount: order.totalAmount,
          createdById: userId,
          updatedById: userId,
        },
        include: INVOICE_INCLUDE,
      });
      return toInvoiceDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, order.id);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateInvoiceInput,
  ): Promise<InvoiceDto> {
    await this.ensureExists(companyId, id);
    const row = await this.prisma.invoice.update({
      where: { id },
      data: { status: input.status, updatedById: userId },
      include: INVOICE_INCLUDE,
    });
    return toInvoiceDto(row);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    if (existing.status !== 'draft') {
      throw new ConflictException(
        `Invoice ${id} is '${existing.status}' and can only be deleted while 'draft'`,
      );
    }
    await this.prisma.invoice.delete({ where: { id } });
  }

  /** Assert an invoice exists for this company, else 404 (no existence leak). */
  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
  }

  /**
   * Map a Prisma unique-constraint violation to a 409. Two `@@unique`s could
   * fire here: `salesOrderId` (the order was invoiced by someone/something
   * else — e.g. a concurrent confirm() — between the availability check and
   * this write) or `[companyId, invoiceNumber]` (astronomically unlikely
   * random-suffix collision, see generateInvoiceNumber()).
   */
  private mapUniqueViolation(error: unknown, salesOrderId: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        `Sales order ${salesOrderId} already has an invoice`,
      );
    }
    return error;
  }
}
