import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { DashboardService, type DashboardSummaryDto } from './dashboard.service';

/**
 * Dashboard summary. Just authenticated (global JwtAuthGuard), no extra
 * @RequirePermission - every logged-in user sees the top-level KPIs; the
 * drill-down list pages they link to already enforce the real per-module
 * permissions (e.g. a user without inventory:product.read can see the "Low
 * stock" count here but the /inventory/stock link will 403 if they click it).
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser): Promise<DashboardSummaryDto> {
    return this.dashboard.getSummary(user.companyId);
  }
}
