import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { FinanceDashboardWidgetsProvider } from './finance-dashboard-widgets.provider';

/**
 * Finance module.
 *
 * Invoice CRUD ({@link InvoicesController}/{@link InvoicesService}) against
 * the pre-existing `Invoice` model (sales.prisma) — see invoices.service.ts's
 * docblock for how this relates to the auto-invoice-on-confirm behavior
 * already implemented in SalesOrdersService. {@link
 * FinanceDashboardWidgetsProvider} contributes the "Open invoices" KPI tile
 * to the dashboard widget registry.
 */
@Module({
  imports: [PrismaModule, DashboardWidgetsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, FinanceDashboardWidgetsProvider],
})
export class FinanceModule {}
