import { Injectable } from '@nestjs/common';
import type { DashboardSummaryDto } from '@erp/contracts';
import { DashboardWidgetRegistry } from '../core/dashboard-widgets';

/**
 * Aggregates whatever every registered {@link DashboardWidgetProvider} has to
 * contribute for a company. This module deliberately knows nothing about
 * Inventory, Sales, or any other feature module — see
 * core/dashboard-widgets for the registry that makes that possible, and
 * inventory/inventory-dashboard-widgets.provider.ts /
 * sales/sales-dashboard-widgets.provider.ts for the two current contributors.
 *
 * Widgets a user's role can't act on are still returned here (not filtered by
 * `requiredPermission` server-side) and hidden on the frontend instead — the
 * previous single-query version of this endpoint made the same call
 * explicitly ("every logged-in user sees the top-level KPIs; the drill-down
 * list pages they link to already enforce the real per-module permissions"),
 * and that reasoning still holds: an aggregate count is low-sensitivity, and
 * the real access control is unchanged at the list-page APIs the widgets link
 * to.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly registry: DashboardWidgetRegistry) {}

  async getSummary(companyId: string): Promise<DashboardSummaryDto> {
    return { widgets: await this.registry.collectAll(companyId) };
  }
}
