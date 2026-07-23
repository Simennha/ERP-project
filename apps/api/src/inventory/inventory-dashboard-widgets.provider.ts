import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Inventory's contribution to the dashboard: low-stock count and total
 * on-hand inventory value. Same computation the old monolithic
 * DashboardService used to do inline — low-stock counting and valuation stay
 * in-memory over the company's stock rows (same bounded-catalog assumption as
 * StockReadService.list) since `available` is computed, not stored.
 */
@Injectable()
export class InventoryDashboardWidgetsProvider
  implements DashboardWidgetProvider, OnModuleInit
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: DashboardWidgetRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async getWidgets(companyId: string): Promise<DashboardWidget[]> {
    const stockItems = await this.prisma.stockItem.findMany({
      where: { companyId },
      select: {
        quantityOnHand: true,
        quantityReserved: true,
        reorderPoint: true,
        product: { select: { costPrice: true } },
      },
    });

    let lowStockCount = 0;
    let totalInventoryValue = 0;
    for (const item of stockItems) {
      const available = item.quantityOnHand - item.quantityReserved;
      if (item.reorderPoint > 0 && available <= item.reorderPoint) {
        lowStockCount += 1;
      }
      totalInventoryValue += item.quantityOnHand * Number(item.product.costPrice);
    }

    return [
      {
        id: 'inventory.lowStockCount',
        kind: 'kpi',
        title: 'Low stock items',
        value: String(lowStockCount),
        format: 'count',
        hint: 'click to view',
        href: '/inventory/stock?lowStock=true',
        requiredPermission: PERMISSIONS.INVENTORY_PRODUCT_READ,
        order: 10,
      },
      {
        id: 'inventory.totalValue',
        kind: 'kpi',
        title: 'Inventory value',
        value: totalInventoryValue.toFixed(2),
        format: 'money',
        hint: 'on-hand x cost, click to view',
        href: '/inventory/stock',
        requiredPermission: PERMISSIONS.INVENTORY_PRODUCT_READ,
        order: 20,
      },
    ];
  }
}
