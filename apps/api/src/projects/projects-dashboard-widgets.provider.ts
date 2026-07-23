import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, type DashboardWidget } from '@erp/contracts';
import {
  DashboardWidgetRegistry,
  type DashboardWidgetProvider,
} from '../core/dashboard-widgets';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Projects' contribution to the dashboard: count of currently-active
 * projects.
 */
@Injectable()
export class ProjectsDashboardWidgetsProvider
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
    const activeCount = await this.prisma.project.count({
      where: { companyId, status: 'active' },
    });

    return [
      {
        id: 'projects.activeProjects',
        kind: 'kpi',
        title: 'Active projects',
        value: String(activeCount),
        format: 'count',
        hint: 'click to view',
        href: '/projects',
        requiredPermission: PERMISSIONS.PROJECTS_PROJECT_READ,
        order: 80,
      },
    ];
  }
}
