import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../core/event-bus/event-bus.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ProcurementDashboardWidgetsProvider } from './procurement-dashboard-widgets.provider';

/**
 * Procurement module — PurchaseOrder + PurchaseOrderLine, the inbound mirror
 * of Sales. Imports InventoryModule for its exported StockService (receive()
 * calls StockService.adjust() per line) and EventBusModule to emit the
 * procurement.purchaseOrder.* lifecycle events — same shape as SalesModule's
 * imports for the same reason (see sales.module.ts).
 */
@Module({
  imports: [PrismaModule, EventBusModule, InventoryModule, DashboardWidgetsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, ProcurementDashboardWidgetsProvider],
})
export class ProcurementModule {}
