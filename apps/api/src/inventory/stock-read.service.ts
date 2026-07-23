import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@erp/database';
import type { Paginated } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import type { StockListQuery, StockMovementsQuery } from './inventory.schemas';

/**
 * A stock level row joined with its product/warehouse names, plus the computed
 * `available = quantityOnHand - quantityReserved` (never stored — see
 * inventory.prisma / StockService).
 */
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
  /** True when available has dropped to or below the reorder point. */
  isLow: boolean;
  updatedAt: string;
}

/** One append-only ledger entry, joined with its warehouse name. */
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

const stockItemInclude = {
  product: { select: { sku: true, name: true } },
  warehouse: { select: { name: true } },
} satisfies Prisma.StockItemInclude;

type StockItemWithRefs = Prisma.StockItemGetPayload<{ include: typeof stockItemInclude }>;

const movementInclude = {
  warehouse: { select: { name: true } },
} satisfies Prisma.StockMovementInclude;

type MovementWithRefs = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;

function toStockItemDto(row: StockItemWithRefs): StockItemDto {
  const available = row.quantityOnHand - row.quantityReserved;
  return {
    id: row.id,
    productId: row.productId,
    productSku: row.product.sku,
    productName: row.product.name,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    quantityOnHand: row.quantityOnHand,
    quantityReserved: row.quantityReserved,
    available,
    reorderPoint: row.reorderPoint,
    reorderQty: row.reorderQty,
    isLow: available <= row.reorderPoint,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStockMovementDto(row: MovementWithRefs): StockMovementDto {
  return {
    id: row.id,
    productId: row.productId,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Read-only inventory queries (the stock-level grid and the per-product
 * movement history) and the company-ownership guard used before a stock
 * adjustment. All mutation still goes exclusively through StockService — this
 * service never writes.
 */
@Injectable()
export class StockReadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stock-level grid. Filters to a warehouse (`warehouseId`) and/or only
   * low-stock rows (`lowStock`, i.e. `available <= reorderPoint`).
   *
   * `available` is computed, so `lowStock` can't be a SQL WHERE clause via the
   * typed Prisma API (it's a column-to-column comparison). For that path we
   * load the company/warehouse rows, filter and paginate in memory — correct
   * for the bounded catalogs of this phase. TODO(dashboard phase): move the
   * low-stock filter to a computed-column / raw SQL query if catalogs grow.
   */
  async list(
    companyId: string,
    query: StockListQuery,
  ): Promise<Paginated<StockItemDto>> {
    const { warehouseId, lowStock, page, pageSize } = query;
    const where: Prisma.StockItemWhereInput = {
      companyId,
      ...(warehouseId ? { warehouseId } : {}),
    };

    if (lowStock) {
      const rows = await this.prisma.stockItem.findMany({
        where,
        include: stockItemInclude,
        orderBy: { product: { name: 'asc' } },
      });
      const filtered = rows.map(toStockItemDto).filter((r) => r.isLow);
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockItem.findMany({
        where,
        include: stockItemInclude,
        orderBy: { product: { name: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return {
      data: rows.map(toStockItemDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Paginated movement ledger for one product (optionally scoped to one
   * warehouse), newest first. 404s if the product does not belong to the
   * caller's company (no existence leak).
   */
  async movements(
    companyId: string,
    productId: string,
    query: StockMovementsQuery,
  ): Promise<Paginated<StockMovementDto>> {
    await this.ensureProductInCompany(companyId, productId);
    const { warehouseId, page, pageSize } = query;
    const where: Prisma.StockMovementWhereInput = {
      companyId,
      productId,
      ...(warehouseId ? { warehouseId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: rows.map(toStockMovementDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Guard used before a stock adjustment: both the product and the warehouse
   * must belong to the caller's company. StockService.adjust() trusts its
   * inputs, so this is where cross-company / non-existent references are turned
   * into a clean 404 instead of a foreign-key error or a stray row.
   */
  async ensureProductAndWarehouseInCompany(
    companyId: string,
    productId: string,
    warehouseId: string,
  ): Promise<void> {
    const [product, warehouse] = await this.prisma.$transaction([
      this.prisma.product.findFirst({
        where: { id: productId, companyId },
        select: { id: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
        select: { id: true },
      }),
    ]);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }
  }

  private async ensureProductInCompany(
    companyId: string,
    productId: string,
  ): Promise<void> {
    const found = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
  }
}
