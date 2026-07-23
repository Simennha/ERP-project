import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { HrDashboardWidgetsProvider } from './hr-dashboard-widgets.provider';

/**
 * HR module. Currently a single-entity stub ({@link EmployeesController} /
 * {@link EmployeesService}) plus a dashboard KPI tile — see hr.prisma's
 * docblock for the intended growth path (linking Employee to User for
 * self-service).
 */
@Module({
  imports: [PrismaModule, DashboardWidgetsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, HrDashboardWidgetsProvider],
})
export class HrModule {}
