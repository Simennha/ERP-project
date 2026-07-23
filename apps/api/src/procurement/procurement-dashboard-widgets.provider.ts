import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Procurement's contribution to the dashboard: a count of purchase orders
 * currently pending (status = 'submitted', i.e. sent to the vendor but not
 * yet received).
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
      where: { companyId, status: 'submitted' },
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
