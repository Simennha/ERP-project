import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ProcurementDashboardWidgetsProvider } from './procurement-dashboard-widgets.provider';

/**
 * Procurement module — PurchaseOrder CRUD stub (no cross-module relation to
 * Inventory/Product yet, see procurement.prisma).
 */
@Module({
  imports: [PrismaModule, DashboardWidgetsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, ProcurementDashboardWidgetsProvider],
})
export class ProcurementModule {}
