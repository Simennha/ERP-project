import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardSummaryDto {
  lowStockCount: number;
  totalInventoryValue: string;
  openOrdersCount: number;
  salesThisMonth: string;
}

/**
 * First real dashboard data: a handful of company-scoped KPIs pulled from
 * Inventory and Sales, proving the "single source of truth" value
 * proposition (numbers here are the same live data the Inventory/Sales list
 * pages show, not a separate reporting copy).
 *
 * This is a deliberately small starting point, NOT the full widget-registry
 * framework described in the project plan (each module contributing its own
 * auto-discovered widgets.ts) - that's still a TODO, left for the next
 * session (see README "Suggested next phases"). Low-stock counting and
 * inventory valuation are computed in memory over the company's stock rows
 * (same bounded-catalog assumption as StockReadService.list) rather than via
 * a SQL aggregate, since `available` is a computed, not stored, column.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(companyId: string): Promise<DashboardSummaryDto> {
    const [stockItems, openOrdersCount, ordersThisMonth] = await Promise.all([
      this.prisma.stockItem.findMany({
        where: { companyId },
        select: {
          quantityOnHand: true,
          quantityReserved: true,
          reorderPoint: true,
          product: { select: { costPrice: true } },
        },
      }),
      this.prisma.salesOrder.count({
        where: { companyId, status: 'confirmed' },
      }),
      this.prisma.salesOrder.findMany({
        where: {
          companyId,
          status: { not: 'cancelled' },
          orderDate: { gte: startOfMonth() },
        },
        select: { totalAmount: true },
      }),
    ]);

    let lowStockCount = 0;
    let totalInventoryValue = 0;
    for (const item of stockItems) {
      const available = item.quantityOnHand - item.quantityReserved;
      if (item.reorderPoint > 0 && available <= item.reorderPoint) {
        lowStockCount += 1;
      }
      totalInventoryValue += item.quantityOnHand * Number(item.product.costPrice);
    }

    const salesThisMonth = ordersThisMonth.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );

    return {
      lowStockCount,
      totalInventoryValue: totalInventoryValue.toFixed(2),
      openOrdersCount,
      salesThisMonth: salesThisMonth.toFixed(2),
    };
  }
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
