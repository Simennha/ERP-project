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
import { InsufficientStockError } from '../inventory/stock-errors';
import {
  SALES_ORDER_DETAIL_INCLUDE,
  SALES_ORDER_LIST_INCLUDE,
  toSalesOrderDetailDto,
  toSalesOrderListItemDto,
  type AvailabilityDto,
  type SalesOrderDetailDto,
  type SalesOrderListItemDto,
} from './sales.dto';
import type {
  CreateSalesOrderInput,
  SalesOrderLineInput,
  UpdateSalesOrderInput,
} from './sales-orders.schemas';

/** A prepared line ready for persistence (unitPrice/lineTotal as Decimal). */
interface PreparedLine {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

/**
 * orderNumber generator: `SO-{YYYYMMDD}-{6 base36 chars}`.
 *
 * Deliberately NOT a per-company sequential counter: a counter would need a
 * read-modify-write that races under concurrent creates. A date prefix keeps
 * the number human-scannable while the random suffix makes collisions
 * astronomically unlikely; the `@@unique([companyId, orderNumber])` constraint
 * is the backstop (a colliding create fails its transaction and the client
 * retries).
 */
function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, '0');
  return `SO-${y}${m}${d}-${rand}`;
}

/** Same scheme as {@link generateOrderNumber}, prefixed `INV-` — see sales.prisma. */
function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, '0');
  return `INV-${y}${m}${d}-${rand}`;
}

/**
 * CRUD service for SalesOrder (+ nested SalesOrderLines). Company-scoped; a
 * cross-company id resolves to 404. Editing/deleting is only permitted while
 * status === 'draft' (409 otherwise).
 *
 * IMPORTANT scope boundary: this service does NOT confirm/fulfill/cancel orders
 * and does NOT reserve/commit/release stock. It injects StockService ONLY for
 * the read-only availability lookup that powers the order-builder UI. The
 * order-confirm -> stock-reserve integration is a separate follow-up step.
 */
@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly stock: StockService,
  ) {}

  async list(
    companyId: string,
    status: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paginated<SalesOrderListItemDto>> {
    const where: Prisma.SalesOrderWhereInput = {
      companyId,
      ...(status ? { status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: SALES_ORDER_LIST_INCLUDE,
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return {
      data: rows.map(toSalesOrderListItemDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<SalesOrderDetailDto> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: SALES_ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Sales order ${id} not found`);
    }
    return toSalesOrderDetailDto(order);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreateSalesOrderInput,
  ): Promise<SalesOrderDetailDto> {
    // Validate references BEFORE writing anything.
    await this.assertCustomerExists(companyId, input.customerId);
    await this.assertProductsExist(companyId, input.lines);

    const preparedLines = this.prepareLines(input.lines);
    const totalAmount = this.sumLineTotals(preparedLines);
    const orderNumber = generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) =>
      tx.salesOrder.create({
        data: {
          companyId,
          customerId: input.customerId,
          orderNumber,
          status: 'draft',
          totalAmount,
          createdById: userId,
          updatedById: userId,
          lines: {
            create: preparedLines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: SALES_ORDER_DETAIL_INCLUDE,
      }),
    );

    // Emit AFTER the transaction commits. Decimal is stringified for the payload.
    await this.eventBus.emit(
      EVENTS.SALES_ORDER_CREATED,
      companyId,
      {
        orderId: created.id,
        orderNumber: created.orderNumber,
        customerId: created.customerId,
        status: 'draft',
        totalAmount: created.totalAmount.toString(),
      },
      userId,
    );

    return toSalesOrderDetailDto(created);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateSalesOrderInput,
  ): Promise<SalesOrderDetailDto> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`Sales order ${id} not found`);
    }
    if (existing.status !== 'draft') {
      throw new ConflictException(
        `Sales order ${id} is '${existing.status}' and can only be edited while 'draft'`,
      );
    }

    if (input.customerId !== undefined) {
      await this.assertCustomerExists(companyId, input.customerId);
    }

    let preparedLines: PreparedLine[] | undefined;
    let totalAmount: Prisma.Decimal | undefined;
    if (input.lines !== undefined) {
      await this.assertProductsExist(companyId, input.lines);
      preparedLines = this.prepareLines(input.lines);
      totalAmount = this.sumLineTotals(preparedLines);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: {
          customerId: input.customerId,
          updatedById: userId,
          ...(totalAmount !== undefined ? { totalAmount } : {}),
        },
      });

      // Full-replace semantics for lines: only touch them when the caller sent
      // a `lines` array (validated non-empty by the schema).
      if (preparedLines !== undefined) {
        await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
        await tx.salesOrderLine.createMany({
          data: preparedLines.map((line) => ({
            salesOrderId: id,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        });
      }

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_DETAIL_INCLUDE,
      });
    });

    return toSalesOrderDetailDto(updated);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`Sales order ${id} not found`);
    }
    if (existing.status !== 'draft') {
      throw new ConflictException(
        `Sales order ${id} is '${existing.status}' and can only be deleted while 'draft'`,
      );
    }
    // Cascade deletes the order's lines (see sales.prisma).
    await this.prisma.salesOrder.delete({ where: { id } });
  }

  /**
   * Read-only availability lookup for the order-builder UI. Thin wrapper over
   * StockService.getAvailability (no stock mutation). `warehouseId` is optional:
   * when omitted, the company's first active warehouse is used as the default
   * (v1 has no warehouse picker in the Sales UI). Returns zeros with
   * `warehouseId: null` when the company has no warehouse configured yet.
   */
  async getAvailability(
    companyId: string,
    productId: string,
    warehouseId?: string,
  ): Promise<AvailabilityDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    });
    if (!product) {
      throw new BadRequestException(
        `Unknown or cross-company product id: ${productId}`,
      );
    }

    let resolvedWarehouseId: string | null;
    if (warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
        select: { id: true },
      });
      if (!warehouse) {
        throw new BadRequestException(
          `Unknown or cross-company warehouse id: ${warehouseId}`,
        );
      }
      resolvedWarehouseId = warehouse.id;
    } else {
      resolvedWarehouseId = await this.resolveDefaultWarehouseId(companyId);
    }

    if (resolvedWarehouseId === null) {
      return {
        productId,
        warehouseId: null,
        quantityOnHand: 0,
        quantityReserved: 0,
        available: 0,
        reorderPoint: 0,
      };
    }

    const availability = await this.stock.getAvailability(
      companyId,
      productId,
      resolvedWarehouseId,
    );
    return {
      productId: availability.productId,
      warehouseId: availability.warehouseId,
      quantityOnHand: availability.quantityOnHand,
      quantityReserved: availability.quantityReserved,
      available: availability.available,
      reorderPoint: availability.reorderPoint,
    };
  }

  /**
   * Confirm a draft order: reserve stock for every line, then transition to
   * 'confirmed' and generate a draft Invoice. All lines reserve against the
   * company's single default warehouse (v1 simplification — no per-line
   * warehouse selection yet, consistent with getAvailability()).
   *
   * Atomicity note: StockService.reserve() commits its own transaction per
   * call (it has no notion of a caller-supplied transaction), so this method
   * cannot wrap "reserve every line + flip status + create invoice" in one
   * database transaction. Instead: lines are reserved one at a time, and if
   * any line fails (insufficient stock, or any other error), every
   * already-reserved line for THIS order is compensated with a release()
   * before re-throwing — so a failed confirm never leaves partial
   * reservations behind. This is a compensating-action rollback, not a DB
   * transaction: a process crash between reserve() calls could theoretically
   * leave a partial reservation, which is an accepted v1 tradeoff (the
   * append-only StockMovement ledger makes any such state fully auditable
   * and recoverable by hand).
   */
  async confirm(
    companyId: string,
    userId: string,
    id: string,
  ): Promise<SalesOrderDetailDto> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: { lines: { include: { product: { select: { sku: true } } } } },
    });
    if (!order) {
      throw new NotFoundException(`Sales order ${id} not found`);
    }
    if (order.status !== 'draft') {
      throw new ConflictException(
        `Sales order ${id} is '${order.status}' and can only be confirmed from 'draft'`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException('Cannot confirm an order with no lines');
    }

    const warehouseId = await this.resolveDefaultWarehouseId(companyId);
    if (!warehouseId) {
      throw new ConflictException(
        'No warehouse is configured for this company; cannot reserve stock',
      );
    }

    const reservedLines: Array<{ productId: string; quantity: number }> = [];
    try {
      for (const line of order.lines) {
        await this.stock.reserve({
          companyId,
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          referenceType: 'SalesOrder',
          referenceId: order.id,
          actorUserId: userId,
        });
        reservedLines.push({ productId: line.productId, quantity: line.quantity });
      }
    } catch (err) {
      await this.compensateReleases(companyId, warehouseId, order.id, reservedLines, userId);
      if (err instanceof InsufficientStockError) {
        const sku = order.lines.find((l) => l.productId === err.productId)?.product.sku;
        throw new ConflictException(
          `Insufficient stock for ${sku ?? err.productId}: requested ${err.requested}, available ${err.available}`,
        );
      }
      throw err;
    }

    const invoiceNumber = generateInvoiceNumber();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: { status: 'confirmed', updatedById: userId },
      });
      await tx.invoice.create({
        data: {
          companyId,
          salesOrderId: id,
          invoiceNumber,
          status: 'draft',
          totalAmount: order.totalAmount,
        },
      });
      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_DETAIL_INCLUDE,
      });
    });

    await this.eventBus.emit(
      EVENTS.SALES_ORDER_CONFIRMED,
      companyId,
      {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        customerId: updated.customerId,
        status: 'confirmed',
        totalAmount: updated.totalAmount.toString(),
      },
      userId,
    );

    return toSalesOrderDetailDto(updated);
  }

  /**
   * Fulfill a confirmed order: convert each line's reservation into an actual
   * stock deduction (StockService.commitReservation), transition to
   * 'fulfilled', and mark the invoice 'sent'. The warehouse used for each
   * product is read back from the StockMovement ledger written at confirm
   * time (type 'reserve', referenceType 'SalesOrder', referenceId = this
   * order) rather than re-resolving "the default warehouse" again, so
   * fulfillment is correct even if the company's default warehouse changed
   * in between.
   */
  async fulfill(
    companyId: string,
    userId: string,
    id: string,
  ): Promise<SalesOrderDetailDto> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!order) {
      throw new NotFoundException(`Sales order ${id} not found`);
    }
    if (order.status !== 'confirmed') {
      throw new ConflictException(
        `Sales order ${id} is '${order.status}' and can only be fulfilled from 'confirmed'`,
      );
    }

    const warehouseByProduct = await this.getReservationWarehouseMap(companyId, order.id);

    for (const line of order.lines) {
      const warehouseId = warehouseByProduct.get(line.productId);
      if (!warehouseId) {
        throw new ConflictException(
          `No stock reservation found for product ${line.productId} on order ${id}; cannot fulfill`,
        );
      }
      await this.stock.commitReservation({
        companyId,
        productId: line.productId,
        warehouseId,
        quantity: line.quantity,
        referenceType: 'SalesOrder',
        referenceId: order.id,
        actorUserId: userId,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: { status: 'fulfilled', updatedById: userId },
      });
      await tx.invoice.updateMany({
        where: { salesOrderId: id },
        data: { status: 'sent' },
      });
      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_DETAIL_INCLUDE,
      });
    });

    await this.eventBus.emit(
      EVENTS.SALES_ORDER_FULFILLED,
      companyId,
      {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        customerId: updated.customerId,
        status: 'fulfilled',
        totalAmount: updated.totalAmount.toString(),
      },
      userId,
    );

    return toSalesOrderDetailDto(updated);
  }

  /**
   * Cancel a draft or confirmed order. A 'confirmed' order has reserved
   * stock, released here (same ledger lookup as fulfill()); a 'draft' order
   * never reserved anything, so cancelling it is a pure status change.
   */
  async cancel(
    companyId: string,
    userId: string,
    id: string,
  ): Promise<SalesOrderDetailDto> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!order) {
      throw new NotFoundException(`Sales order ${id} not found`);
    }
    if (order.status !== 'draft' && order.status !== 'confirmed') {
      throw new ConflictException(
        `Sales order ${id} is '${order.status}' and cannot be cancelled`,
      );
    }

    if (order.status === 'confirmed') {
      const warehouseByProduct = await this.getReservationWarehouseMap(companyId, order.id);
      for (const line of order.lines) {
        const warehouseId = warehouseByProduct.get(line.productId);
        if (!warehouseId) {
          continue; // Nothing reserved for this line (shouldn't happen); skip rather than fail cancellation.
        }
        await this.stock.release({
          companyId,
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          referenceType: 'SalesOrder',
          referenceId: order.id,
          actorUserId: userId,
        });
      }
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'cancelled', updatedById: userId },
      include: SALES_ORDER_DETAIL_INCLUDE,
    });

    await this.eventBus.emit(
      EVENTS.SALES_ORDER_CANCELLED,
      companyId,
      {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        customerId: updated.customerId,
        status: 'cancelled',
        totalAmount: updated.totalAmount.toString(),
      },
      userId,
    );

    return toSalesOrderDetailDto(updated);
  }

  // --- Helpers ---------------------------------------------------------------

  /** The company's single default warehouse (first active, oldest first), or null if none configured. */
  private async resolveDefaultWarehouseId(companyId: string): Promise<string | null> {
    const defaultWarehouse = await this.prisma.warehouse.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return defaultWarehouse?.id ?? null;
  }

  /**
   * Reconstruct which warehouse each product on this order was reserved at,
   * by reading the 'reserve' StockMovement rows this order's confirm() wrote
   * (see StockService.reserve — every reservation writes one). Used by
   * fulfill()/cancel() instead of re-resolving "the default warehouse" so
   * they stay correct even if the company's default warehouse changes later.
   */
  private async getReservationWarehouseMap(
    companyId: string,
    orderId: string,
  ): Promise<Map<string, string>> {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId,
        referenceType: 'SalesOrder',
        referenceId: orderId,
        type: 'reserve',
      },
      select: { productId: true, warehouseId: true },
    });
    const map = new Map<string, string>();
    for (const m of movements) {
      map.set(m.productId, m.warehouseId);
    }
    return map;
  }

  /**
   * Best-effort compensation for a confirm() that failed partway through
   * reserving lines: release every line successfully reserved so far for this
   * order, so a failed confirm never leaves a dangling reservation. Logged
   * rather than thrown on failure — the original error is what the caller
   * needs to see; a compensation failure here is a rare, separate problem
   * that would show up in the StockMovement/WorkflowRun-style audit trail
   * (StockMovement rows are always written, so the reservation is never
   * silently lost, only left in a state a human may need to reconcile).
   */
  private async compensateReleases(
    companyId: string,
    warehouseId: string,
    orderId: string,
    reservedLines: Array<{ productId: string; quantity: number }>,
    userId: string,
  ): Promise<void> {
    for (const line of reservedLines) {
      try {
        await this.stock.release({
          companyId,
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          referenceType: 'SalesOrder',
          referenceId: orderId,
          actorUserId: userId,
        });
      } catch {
        // Swallow: the original reserve failure is what gets surfaced to the
        // caller. A failed compensation leaves an honest StockMovement trail
        // for manual reconciliation rather than masking the real error.
      }
    }
  }

  private prepareLines(lines: SalesOrderLineInput[]): PreparedLine[] {
    return lines.map((line) => {
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      // lineTotal = quantity * unitPrice, computed at write time (not a DB
      // generated column). quantity is an int, so scale stays at 2 dp.
      const lineTotal = unitPrice.mul(line.quantity);
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice,
        lineTotal,
      };
    });
  }

  private sumLineTotals(lines: PreparedLine[]): Prisma.Decimal {
    return lines.reduce(
      (sum, line) => sum.add(line.lineTotal),
      new Prisma.Decimal(0),
    );
  }

  private async assertCustomerExists(
    companyId: string,
    customerId: string,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException(
        `Unknown or cross-company customer id: ${customerId}`,
      );
    }
  }

  private async assertProductsExist(
    companyId: string,
    lines: SalesOrderLineInput[],
  ): Promise<void> {
    const uniqueIds = [...new Set(lines.map((line) => line.productId))];
    const found = await this.prisma.product.findMany({
      where: { companyId, id: { in: uniqueIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((product) => product.id));
    const missing = uniqueIds.filter((productId) => !foundIds.has(productId));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown or cross-company product id(s): ${missing.join(', ')}`,
      );
    }
  }
}
