import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@erp/database';
import { EVENTS, type Paginated } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../core/event-bus/event-bus.service';
import { StockService } from '../inventory/stock.service';
import type {
  CreatePurchaseOrderInput,
  PurchaseOrderLineInput,
  PurchaseOrderListQuery,
  ReceivePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from './procurement.schemas';

/**
 * Client-facing shapes for PurchaseOrder (+ nested PurchaseOrderLine) and the
 * mappers that build them from Prisma rows.
 *
 * ── Decimal handling (IMPORTANT) ─────────────────────────────────────────────
 * Money columns (unitCost, lineTotal, totalAmount) are Prisma Decimal, which
 * at runtime are Decimal.js objects — NOT plain numbers. Every mapper here
 * explicitly stringifies them (`.toFixed(2)`), matching every other module's
 * convention (see sales.dto.ts). Dates are ISO-8601 strings for the same reason.
 */

// --- Prisma include shapes (single source of truth for service + mapper) -----

const PURCHASE_ORDER_DETAIL_INCLUDE = {
  lines: {
    include: {
      product: { select: { name: true, sku: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.PurchaseOrderInclude;

type PurchaseOrderDetailRow = Prisma.PurchaseOrderGetPayload<{
  include: typeof PURCHASE_ORDER_DETAIL_INCLUDE;
}>;

// --- DTO interfaces ------------------------------------------------------------

export interface PurchaseOrderLineDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  quantityOrdered: number;
  quantityReceived: number;
  /** Decimal, fixed 2dp string (e.g. "10.00"). */
  unitCost: string;
  /** Decimal, fixed 2dp string. */
  lineTotal: string;
}

export interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  /** Decimal, fixed 2dp string. */
  totalAmount: string;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  lines: PurchaseOrderLineDto[];
  createdAt: string;
  updatedAt: string;
}

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

function toPurchaseOrderDto(row: PurchaseOrderDetailRow): PurchaseOrderDto {
  return {
    id: row.id,
    poNumber: row.poNumber,
    vendorName: row.vendorName,
    status: row.status,
    totalAmount: row.totalAmount.toFixed(2),
    orderDate: row.orderDate.toISOString(),
    expectedDate: row.expectedDate ? row.expectedDate.toISOString() : null,
    notes: row.notes,
    lines: row.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.product?.name ?? '',
      productSku: line.product?.sku ?? '',
      warehouseId: line.warehouseId,
      warehouseName: line.warehouse?.name ?? '',
      quantityOrdered: line.quantityOrdered,
      quantityReceived: line.quantityReceived,
      unitCost: line.unitCost.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPurchaseOrderListItemDto(row: {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  totalAmount: Prisma.Decimal;
  orderDate: Date;
  expectedDate: Date | null;
  createdAt: Date;
}): PurchaseOrderListItemDto {
  return {
    id: row.id,
    poNumber: row.poNumber,
    vendorName: row.vendorName,
    status: row.status,
    totalAmount: row.totalAmount.toFixed(2),
    orderDate: row.orderDate.toISOString(),
    expectedDate: row.expectedDate ? row.expectedDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A prepared line ready for persistence (unitCost/lineTotal as Decimal). */
interface PreparedLine {
  productId: string;
  warehouseId: string;
  quantityOrdered: number;
  unitCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

/**
 * PurchaseOrder (+ nested PurchaseOrderLine) CRUD, plus the
 * submit/receive/cancel lifecycle actions — the inbound mirror of
 * SalesOrdersService's confirm/fulfill/cancel. Everything is company-scoped:
 * reads/writes filter by the caller's companyId, and a cross-company (or
 * missing) id resolves to 404. The `@@unique([companyId, poNumber])`
 * constraint is surfaced as a 409 Conflict.
 *
 * Lifecycle: draft -> submitted -> (partiallyReceived ->)* received, with
 * cancelled reachable from draft/submitted only (once any stock has
 * physically arrived there's nothing clean to roll back — see receive()).
 * Lines are only editable while 'draft'.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly stock: StockService,
  ) {}

  async list(
    companyId: string,
    query: PurchaseOrderListQuery,
  ): Promise<Paginated<PurchaseOrderListItemDto>> {
    const { status, page, pageSize } = query;
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      ...(status ? { status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: rows.map(toPurchaseOrderListItemDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<PurchaseOrderDto> {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return toPurchaseOrderDto(row);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    await this.assertLineReferencesExist(companyId, input.lines);

    const preparedLines = this.prepareLines(input.lines);
    const totalAmount = this.sumLineTotals(preparedLines);

    let created: PurchaseOrderDetailRow;
    try {
      created = await this.prisma.$transaction((tx) =>
        tx.purchaseOrder.create({
          data: {
            companyId,
            poNumber: input.poNumber,
            vendorName: input.vendorName,
            status: 'draft',
            totalAmount,
            orderDate: input.orderDate,
            expectedDate: input.expectedDate,
            notes: input.notes,
            createdById: userId,
            updatedById: userId,
            lines: {
              create: preparedLines.map((line) => ({
                productId: line.productId,
                warehouseId: line.warehouseId,
                quantityOrdered: line.quantityOrdered,
                unitCost: line.unitCost,
                lineTotal: line.lineTotal,
              })),
            },
          },
          include: PURCHASE_ORDER_DETAIL_INCLUDE,
        }),
      );
    } catch (error) {
      throw this.mapUniqueViolation(error, input.poNumber);
    }

    await this.eventBus.emit(
      EVENTS.PROCUREMENT_PURCHASE_ORDER_CREATED,
      companyId,
      {
        purchaseOrderId: created.id,
        poNumber: created.poNumber,
        vendorName: created.vendorName,
        status: 'draft',
        totalAmount: created.totalAmount.toString(),
      },
      userId,
    );

    return toPurchaseOrderDto(created);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (existing.status !== 'draft') {
      throw new ConflictException(
        `Purchase order ${id} is '${existing.status}' and can only be edited while 'draft'`,
      );
    }

    let preparedLines: PreparedLine[] | undefined;
    let totalAmount: Prisma.Decimal | undefined;
    if (input.lines !== undefined) {
      await this.assertLineReferencesExist(companyId, input.lines);
      preparedLines = this.prepareLines(input.lines);
      totalAmount = this.sumLineTotals(preparedLines);
    }

    let updated: PurchaseOrderDetailRow;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            poNumber: input.poNumber,
            vendorName: input.vendorName,
            orderDate: input.orderDate,
            expectedDate: input.expectedDate,
            notes: input.notes,
            updatedById: userId,
            ...(totalAmount !== undefined ? { totalAmount } : {}),
          },
        });

        // Full-replace semantics for lines: only touch them when the caller
        // sent a `lines` array (validated non-empty by the schema).
        if (preparedLines !== undefined) {
          await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
          await tx.purchaseOrderLine.createMany({
            data: preparedLines.map((line) => ({
              purchaseOrderId: id,
              productId: line.productId,
              warehouseId: line.warehouseId,
              quantityOrdered: line.quantityOrdered,
              unitCost: line.unitCost,
              lineTotal: line.lineTotal,
            })),
          });
        }

        return tx.purchaseOrder.findUniqueOrThrow({
          where: { id },
          include: PURCHASE_ORDER_DETAIL_INCLUDE,
        });
      });
    } catch (error) {
      throw this.mapUniqueViolation(error, input.poNumber ?? id);
    }

    return toPurchaseOrderDto(updated);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (existing.status !== 'draft') {
      throw new ConflictException(
        `Purchase order ${id} is '${existing.status}' and can only be deleted while 'draft'`,
      );
    }
    // Cascade deletes the PO's lines (see procurement.prisma).
    await this.prisma.purchaseOrder.delete({ where: { id } });
  }

  /** Submit a draft PO to the vendor: draft -> submitted. Pure status change — nothing to reserve on the inbound side. */
  async submit(companyId: string, userId: string, id: string): Promise<PurchaseOrderDto> {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (order.status !== 'draft') {
      throw new ConflictException(
        `Purchase order ${id} is '${order.status}' and can only be submitted from 'draft'`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException('Cannot submit a purchase order with no lines');
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'submitted', updatedById: userId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });

    await this.emitStatusEvent(EVENTS.PROCUREMENT_PURCHASE_ORDER_SUBMITTED, companyId, updated, userId);
    return toPurchaseOrderDto(updated);
  }

  /**
   * Receive goods against one or more lines (partial or full) — the inbound
   * mirror of SalesOrdersService.fulfill(). For each `{ lineId,
   * quantityReceived }` entry: validates it doesn't exceed that line's
   * remaining quantity, then calls `StockService.adjust()` with a positive
   * delta (a real physical stock increase, referenced back to this PO) and
   * increments the line's `quantityReceived`.
   *
   * Unlike SalesOrdersService.confirm() (which compensates a partial failure
   * by releasing already-reserved lines — reserving is speculative, so
   * undoing it is safe and correct), a receive() that fails partway through
   * is NOT compensated: the lines that already succeeded represent goods that
   * have genuinely, physically arrived, so "rolling back" would make the
   * recorded stock lie. A failed call simply leaves the PO in a
   * correctly-partial state (some lines updated, the failing one and any
   * after it not), fully visible via the StockMovement ledger and each
   * line's quantityReceived — the caller can safely retry just the
   * remaining lines.
   *
   * Same cross-call-transaction caveat as confirm()/fulfill(): StockService
   * manages its own transaction per call, so this is sequential calls, not
   * one wrapping DB transaction.
   */
  async receive(
    companyId: string,
    userId: string,
    id: string,
    input: ReceivePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (order.status !== 'submitted' && order.status !== 'partiallyReceived') {
      throw new ConflictException(
        `Purchase order ${id} is '${order.status}' and can only be received from 'submitted' or 'partiallyReceived'`,
      );
    }

    const lineById = new Map(order.lines.map((line) => [line.id, line]));
    for (const entry of input.lines) {
      const line = lineById.get(entry.lineId);
      if (!line) {
        throw new BadRequestException(`Line ${entry.lineId} does not belong to purchase order ${id}`);
      }
      const remaining = line.quantityOrdered - line.quantityReceived;
      if (entry.quantityReceived > remaining) {
        throw new BadRequestException(
          `Cannot receive ${entry.quantityReceived} of line ${entry.lineId}: only ${remaining} remaining`,
        );
      }
    }

    for (const entry of input.lines) {
      // Non-null: validated above.
      const line = lineById.get(entry.lineId)!;
      await this.stock.adjust({
        companyId,
        productId: line.productId,
        warehouseId: line.warehouseId,
        delta: entry.quantityReceived,
        reason: 'Purchase order received',
        referenceType: 'PurchaseOrder',
        referenceId: id,
        actorUserId: userId,
      });
      await this.prisma.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: entry.quantityReceived } },
      });
    }

    const refreshed = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });
    const fullyReceived = refreshed.lines.every((line) => line.quantityReceived >= line.quantityOrdered);
    const newStatus = fullyReceived ? 'received' : 'partiallyReceived';

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: newStatus, updatedById: userId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });

    await this.emitStatusEvent(
      fullyReceived
        ? EVENTS.PROCUREMENT_PURCHASE_ORDER_RECEIVED
        : EVENTS.PROCUREMENT_PURCHASE_ORDER_PARTIALLY_RECEIVED,
      companyId,
      updated,
      userId,
    );
    return toPurchaseOrderDto(updated);
  }

  /**
   * Cancel a draft or submitted PO. Only reachable from those two statuses —
   * a 'partiallyReceived'/'received' PO has already moved real stock, and
   * there's no reservation to release (unlike Sales), so there is nothing
   * clean for cancel to undo once receiving has started.
   */
  async cancel(companyId: string, userId: string, id: string): Promise<PurchaseOrderDto> {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (order.status !== 'draft' && order.status !== 'submitted') {
      throw new ConflictException(
        `Purchase order ${id} is '${order.status}' and cannot be cancelled`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'cancelled', updatedById: userId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });

    await this.emitStatusEvent(EVENTS.PROCUREMENT_PURCHASE_ORDER_CANCELLED, companyId, updated, userId);
    return toPurchaseOrderDto(updated);
  }

  // --- Helpers ---------------------------------------------------------------

  private async emitStatusEvent(
    eventName:
      | typeof EVENTS.PROCUREMENT_PURCHASE_ORDER_SUBMITTED
      | typeof EVENTS.PROCUREMENT_PURCHASE_ORDER_PARTIALLY_RECEIVED
      | typeof EVENTS.PROCUREMENT_PURCHASE_ORDER_RECEIVED
      | typeof EVENTS.PROCUREMENT_PURCHASE_ORDER_CANCELLED,
    companyId: string,
    order: PurchaseOrderDetailRow,
    userId: string,
  ): Promise<void> {
    await this.eventBus.emit(
      eventName,
      companyId,
      {
        purchaseOrderId: order.id,
        poNumber: order.poNumber,
        vendorName: order.vendorName,
        status: order.status as 'draft' | 'submitted' | 'partiallyReceived' | 'received' | 'cancelled',
        totalAmount: order.totalAmount.toString(),
      },
      userId,
    );
  }

  private prepareLines(lines: PurchaseOrderLineInput[]): PreparedLine[] {
    return lines.map((line) => {
      const unitCost = new Prisma.Decimal(line.unitCost);
      // lineTotal = quantityOrdered * unitCost, computed at write time (not a
      // DB generated column). quantityOrdered is an int, so scale stays 2dp.
      const lineTotal = unitCost.mul(line.quantityOrdered);
      return {
        productId: line.productId,
        warehouseId: line.warehouseId,
        quantityOrdered: line.quantityOrdered,
        unitCost,
        lineTotal,
      };
    });
  }

  private sumLineTotals(lines: PreparedLine[]): Prisma.Decimal {
    return lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
  }

  private async assertLineReferencesExist(
    companyId: string,
    lines: PurchaseOrderLineInput[],
  ): Promise<void> {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const warehouseIds = [...new Set(lines.map((line) => line.warehouseId))];

    const [foundProducts, foundWarehouses] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true },
      }),
      this.prisma.warehouse.findMany({
        where: { companyId, id: { in: warehouseIds } },
        select: { id: true },
      }),
    ]);

    const foundProductIds = new Set(foundProducts.map((p) => p.id));
    const missingProducts = productIds.filter((id) => !foundProductIds.has(id));
    if (missingProducts.length > 0) {
      throw new BadRequestException(
        `Unknown or cross-company product id(s): ${missingProducts.join(', ')}`,
      );
    }

    const foundWarehouseIds = new Set(foundWarehouses.map((w) => w.id));
    const missingWarehouses = warehouseIds.filter((id) => !foundWarehouseIds.has(id));
    if (missingWarehouses.length > 0) {
      throw new BadRequestException(
        `Unknown or cross-company warehouse id(s): ${missingWarehouses.join(', ')}`,
      );
    }
  }

  /** Map a Prisma unique-constraint violation (duplicate PO number) to a 409. */
  private mapUniqueViolation(error: unknown, poNumber: string): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`A purchase order with number "${poNumber}" already exists`);
    }
    return error;
  }
}
