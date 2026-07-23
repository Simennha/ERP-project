import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';

/**
 * Contributes HR's dashboard tile(s). Self-registers with
 * {@link DashboardWidgetRegistry} on module init rather than being hand-listed
 * anywhere else — see that class's docblock for why.
 */
@Injectable()
export class HrDashboardWidgetsProvider implements DashboardWidgetProvider, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: DashboardWidgetRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async getWidgets(companyId: string): Promise<DashboardWidget[]> {
    const count = await this.prisma.employee.count({
      where: { companyId, employmentStatus: 'active' },
    });

    return [
      {
        id: 'hr.activeEmployees',
        kind: 'kpi',
        title: 'Active employees',
        value: String(count),
        format: 'count',
        hint: 'click to view',
        href: '/hr/employees',
        requiredPermission: PERMISSIONS.HR_EMPLOYEE_READ,
        order: 60,
      },
    ];
  }
}
