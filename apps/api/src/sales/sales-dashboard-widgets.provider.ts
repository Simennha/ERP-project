import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sales' contribution to the dashboard: open (confirmed, unfulfilled) order
 * count and this calendar month's confirmed sales total. Same computation the
 * old monolithic DashboardService used to do inline.
 */
@Injectable()
export class SalesDashboardWidgetsProvider implements DashboardWidgetProvider, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: DashboardWidgetRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async getWidgets(companyId: string): Promise<DashboardWidget[]> {
    const [openOrdersCount, ordersThisMonth] = await Promise.all([
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

    const salesThisMonth = ordersThisMonth.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );

    return [
      {
        id: 'sales.openOrders',
        kind: 'kpi',
        title: 'Orders pending fulfillment',
        value: String(openOrdersCount),
        format: 'count',
        hint: 'click to view',
        href: '/sales/orders?status=confirmed',
        requiredPermission: PERMISSIONS.SALES_ORDER_READ,
        order: 30,
      },
      {
        id: 'sales.salesThisMonth',
        kind: 'kpi',
        title: 'Sales this month',
        value: salesThisMonth.toFixed(2),
        format: 'money',
        hint: 'click to view',
        href: '/sales/orders',
        requiredPermission: PERMISSIONS.SALES_ORDER_READ,
        order: 40,
      },
    ];
  }
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
