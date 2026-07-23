import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportingDashboardWidgetsProvider } from './reporting-dashboard-widgets.provider';

@Module({
  imports: [PrismaModule, DashboardWidgetsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportingDashboardWidgetsProvider],
})
export class ReportingModule {}
