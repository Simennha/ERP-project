import { Injectable, Logger } from '@nestjs/common';
import { EVENTS } from '@erp/contracts';
import { Prisma } from '@erp/database';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../core/event-bus/event-bus.service';
import { InsufficientStockError, InvalidReservationError } from './stock-errors';

export interface StockMutationParams {
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  actorUserId?: string | null;
}

export interface StockAdjustParams {
  companyId: string;
  productId: string;
  warehouseId: string;
  /** Signed change to quantityOnHand. Positive = stock in, negative = stock out/write-off. */
  delta: number;
  reason?: string;
  actorUserId?: string | null;
}

export interface AvailableQuantity {
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
  reorderPoint: number;
}

/**
 * The single place every module goes through to change stock levels.
 *
 * Every method runs its DB writes in one transaction (StockItem counters +
 * the StockMovement audit-ledger row that explains the change), and — ONLY
 * after that transaction commits — emits `inventory.stock.updated` (and
 * `inventory.stock.low` when the resulting available quantity has dropped to
 * or below the reorder point) via EventBusService. This is what lets Sales
 * (or any other module) react to stock changes in real time without polling.
 *
 * `quantityOnHand` is the physical count; `quantityReserved` is stock already
 * committed to open orders. `available = quantityOnHand - quantityReserved`
 * is always computed, never stored.
 *
 * Concurrency: every mutator's initial read (`lockStockItemForUpdate`) is a
 * `SELECT ... FOR UPDATE` row lock, not a plain `findFirst`. Without it, two
 * concurrent calls against the same StockItem (e.g. two customers confirming
 * orders for the last units of a product at the same moment) could both read
 * the same pre-write `available`/`reserved` value under Postgres's default
 * READ COMMITTED isolation, both pass the application-level check, and both
 * apply their write — overselling stock. The row lock forces the second
 * transaction to block until the first commits (or rolls back) and reads the
 * now-current row, so the check-then-write is effectively atomic per row.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Read-only: current stock position for one product at one warehouse. */
  async getAvailability(
    companyId: string,
    productId: string,
    warehouseId: string,
  ): Promise<AvailableQuantity> {
    const stockItem = await this.prisma.stockItem.findFirst({
      where: { companyId, productId, warehouseId },
    });
    const quantityOnHand = stockItem?.quantityOnHand ?? 0;
    const quantityReserved = stockItem?.quantityReserved ?? 0;
    return {
      productId,
      warehouseId,
      quantityOnHand,
      quantityReserved,
      available: quantityOnHand - quantityReserved,
      reorderPoint: stockItem?.reorderPoint ?? 0,
    };
  }

  /**
   * Reserve stock for an open order. Fails with InsufficientStockError if
   * available (onHand - reserved) is less than requested — does NOT touch
   * quantityOnHand, only quantityReserved (the physical stock hasn't moved
   * yet; it's earmarked). Typically called inside SalesOrderService.confirm().
   */
  async reserve(params: StockMutationParams) {
    this.assertPositiveQuantity(params.quantity);
    const { companyId, productId, warehouseId, quantity, referenceType, referenceId, actorUserId } = params;

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockStockItemForUpdate(tx, companyId, productId, warehouseId);
      const onHand = existing?.quantityOnHand ?? 0;
      const reserved = existing?.quantityReserved ?? 0;
      const available = onHand - reserved;

      if (available < quantity) {
        throw new InsufficientStockError(productId, warehouseId, quantity, available);
      }

      const stockItem = await tx.stockItem.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { quantityReserved: { increment: quantity } },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          warehouseId,
          type: 'reserve',
          quantity: -quantity,
          reason: 'Reserved for order',
          referenceType,
          referenceId,
          createdById: actorUserId ?? undefined,
        },
      });

      return stockItem;
    });

    await this.emitStockUpdated(companyId, updated, 'reserve', -quantity, referenceType, referenceId, actorUserId);
    return updated;
  }

  /**
   * Convert a reservation into an actual deduction on fulfillment: reduces
   * BOTH quantityOnHand and quantityReserved by the same amount (the goods
   * have physically left and the earmark is no longer needed).
   */
  async commitReservation(params: StockMutationParams) {
    this.assertPositiveQuantity(params.quantity);
    const { companyId, productId, warehouseId, quantity, referenceType, referenceId, actorUserId } = params;

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockStockItemForUpdate(tx, companyId, productId, warehouseId);
      const reserved = existing?.quantityReserved ?? 0;

      if (reserved < quantity) {
        throw new InvalidReservationError(
          `Cannot commit ${quantity} units of product ${productId} at warehouse ${warehouseId}: only ${reserved} reserved`,
        );
      }

      const stockItem = await tx.stockItem.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: {
          quantityOnHand: { decrement: quantity },
          quantityReserved: { decrement: quantity },
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          warehouseId,
          type: 'commit',
          quantity: -quantity,
          reason: 'Reservation fulfilled',
          referenceType,
          referenceId,
          createdById: actorUserId ?? undefined,
        },
      });

      return stockItem;
    });

    await this.emitStockUpdated(companyId, updated, 'commit', -quantity, referenceType, referenceId, actorUserId);
    return updated;
  }

  /**
   * Cancel a reservation (e.g. order cancelled before fulfillment): gives the
   * quantity back to `available` by reducing quantityReserved. Does NOT touch
   * quantityOnHand — nothing physically moved.
   */
  async release(params: StockMutationParams) {
    this.assertPositiveQuantity(params.quantity);
    const { companyId, productId, warehouseId, quantity, referenceType, referenceId, actorUserId } = params;

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockStockItemForUpdate(tx, companyId, productId, warehouseId);
      const reserved = existing?.quantityReserved ?? 0;

      if (reserved < quantity) {
        throw new InvalidReservationError(
          `Cannot release ${quantity} units of product ${productId} at warehouse ${warehouseId}: only ${reserved} reserved`,
        );
      }

      const stockItem = await tx.stockItem.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { quantityReserved: { decrement: quantity } },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          warehouseId,
          type: 'release',
          quantity,
          reason: 'Reservation released',
          referenceType,
          referenceId,
          createdById: actorUserId ?? undefined,
        },
      });

      return stockItem;
    });

    await this.emitStockUpdated(companyId, updated, 'release', quantity, referenceType, referenceId, actorUserId);
    return updated;
  }

  /**
   * Manual correction to quantityOnHand (initial stock entry, stocktake
   * correction, write-off, ...). Permission-gated at the controller
   * (`inventory:stock.adjust`), not here. Creates the StockItem row if this is
   * the product's first stock entry at this warehouse.
   */
  async adjust(params: StockAdjustParams) {
    const { companyId, productId, warehouseId, delta, reason, actorUserId } = params;
    if (delta === 0) {
      throw new Error('adjust: delta must be non-zero');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockStockItemForUpdate(tx, companyId, productId, warehouseId);
      const currentOnHand = existing?.quantityOnHand ?? 0;

      if (currentOnHand + delta < 0) {
        throw new InsufficientStockError(productId, warehouseId, -delta, currentOnHand);
      }

      const stockItem = await tx.stockItem.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        update: { quantityOnHand: { increment: delta } },
        create: {
          companyId,
          productId,
          warehouseId,
          quantityOnHand: delta,
          quantityReserved: 0,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          warehouseId,
          type: 'adjust',
          quantity: delta,
          reason: reason ?? 'Manual adjustment',
          createdById: actorUserId ?? undefined,
        },
      });

      return stockItem;
    });

    await this.emitStockUpdated(companyId, updated, 'adjust', delta, undefined, undefined, actorUserId);
    return updated;
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`quantity must be a positive number, got ${quantity}`);
    }
  }

  /**
   * Read a StockItem row with a `SELECT ... FOR UPDATE` row lock, inside the
   * caller's transaction — see the class docblock's "Concurrency" note for
   * why this replaces a plain `findFirst` in every mutator. Returns
   * `undefined` if no row exists yet (nothing to lock — safe, since the only
   * caller that creates a brand-new row, `adjust()`'s upsert, relies on
   * Postgres's atomic `INSERT ... ON CONFLICT` for that specific race, not on
   * this lock).
   */
  private async lockStockItemForUpdate(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string,
    warehouseId: string,
  ): Promise<
    { id: string; quantityOnHand: number; quantityReserved: number; reorderPoint: number } | undefined
  > {
    const rows = await tx.$queryRaw<
      Array<{ id: string; quantityOnHand: number; quantityReserved: number; reorderPoint: number }>
    >(
      Prisma.sql`SELECT "id", "quantityOnHand", "quantityReserved", "reorderPoint" FROM "StockItem" WHERE "companyId" = ${companyId} AND "productId" = ${productId} AND "warehouseId" = ${warehouseId} FOR UPDATE`,
    );
    return rows[0];
  }

  private async emitStockUpdated(
    companyId: string,
    stockItem: { productId: string; warehouseId: string; quantityOnHand: number; quantityReserved: number; reorderPoint: number },
    reason: 'reserve' | 'release' | 'commit' | 'adjust',
    delta: number,
    referenceType: string | undefined,
    referenceId: string | undefined,
    actorUserId: string | null | undefined,
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: stockItem.productId },
      select: { sku: true },
    });

    await this.eventBus.emit(
      EVENTS.INVENTORY_STOCK_UPDATED,
      companyId,
      {
        productId: stockItem.productId,
        productSku: product?.sku ?? '',
        warehouseId: stockItem.warehouseId,
        quantityOnHand: stockItem.quantityOnHand,
        quantityReserved: stockItem.quantityReserved,
        delta,
        reason,
        referenceType,
        referenceId,
      },
      actorUserId ?? null,
    );

    // Trigger on AVAILABLE (onHand - reserved) — that's what determines
    // whether a new order can still be fulfilled — but report the actual
    // quantityOnHand in the payload, matching the field's name.
    const available = stockItem.quantityOnHand - stockItem.quantityReserved;
    if (stockItem.reorderPoint > 0 && available <= stockItem.reorderPoint) {
      await this.eventBus.emit(
        EVENTS.INVENTORY_STOCK_LOW,
        companyId,
        {
          productId: stockItem.productId,
          productSku: product?.sku ?? '',
          warehouseId: stockItem.warehouseId,
          quantityOnHand: stockItem.quantityOnHand,
          reorderPoint: stockItem.reorderPoint,
        },
        actorUserId ?? null,
      );
    }
  }
}
