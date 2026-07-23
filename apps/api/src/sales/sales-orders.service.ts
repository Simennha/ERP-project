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
      const defaultWarehouse = await this.prisma.warehouse.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      resolvedWarehouseId = defaultWarehouse?.id ?? null;
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

  // --- Helpers ---------------------------------------------------------------

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
