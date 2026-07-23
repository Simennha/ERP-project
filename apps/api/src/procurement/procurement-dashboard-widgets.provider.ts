import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Procurement's contribution to the dashboard: a count of purchase orders
 * currently pending (sent to the vendor but not yet fully received —
 * 'submitted' or 'partiallyReceived').
 */
@Injectable()
export class ProcurementDashboardWidgetsProvider
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
    const pendingCount = await this.prisma.purchaseOrder.count({
      where: { companyId, status: { in: ['submitted', 'partiallyReceived'] } },
    });

    return [
      {
        id: 'procurement.pendingOrders',
        kind: 'kpi',
        title: 'Purchase orders pending',
        value: String(pendingCount),
        format: 'count',
        hint: 'click to view',
        href: '/procurement/purchase-orders',
        requiredPermission: PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ,
        order: 70,
      },
    ];
  }
}
