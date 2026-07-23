import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Finance's contribution to the dashboard: how many invoices are still open
 * (not yet 'paid'). Same self-registration pattern as
 * InventoryDashboardWidgetsProvider / SalesDashboardWidgetsProvider.
 */
@Injectable()
export class FinanceDashboardWidgetsProvider implements DashboardWidgetProvider, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: DashboardWidgetRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async getWidgets(companyId: string): Promise<DashboardWidget[]> {
    const openInvoicesCount = await this.prisma.invoice.count({
      where: { companyId, status: { not: 'paid' } },
    });

    return [
      {
        id: 'finance.openInvoices',
        kind: 'kpi',
        title: 'Open invoices',
        value: String(openInvoicesCount),
        format: 'count',
        hint: 'click to view',
        href: '/finance/invoices',
        requiredPermission: PERMISSIONS.FINANCE_INVOICE_READ,
        order: 50,
      },
    ];
  }
}
