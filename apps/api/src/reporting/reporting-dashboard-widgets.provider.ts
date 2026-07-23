import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';
import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';

@Injectable()
export class ReportingDashboardWidgetsProvider implements DashboardWidgetProvider, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: DashboardWidgetRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async getWidgets(companyId: string): Promise<DashboardWidget[]> {
    const count = await this.prisma.report.count({ where: { companyId } });

    return [
      {
        id: 'reporting.savedReports',
        kind: 'kpi',
        title: 'Saved reports',
        value: String(count),
        format: 'count',
        hint: 'click to view',
        href: '/reporting/reports',
        requiredPermission: PERMISSIONS.REPORTING_REPORT_READ,
        order: 90,
      },
    ];
  }
}
