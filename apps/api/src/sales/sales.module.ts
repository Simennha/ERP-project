import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../core/event-bus/event-bus.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';
import { SalesDashboardWidgetsProvider } from './sales-dashboard-widgets.provider';

/**
 * Sales module — Customer + SalesOrder CRUD (Phase 3).
 *
 * Imports:
 * - PrismaModule (@Global, imported explicitly for clarity) for DB access.
 * - EventBusModule to inject EventBusService (emits SALES_ORDER_CREATED).
 * - InventoryModule for its exported StockService — used ONLY for the read-only
 *   `/sales/availability` lookup in the order builder. This module does NOT
 *   mutate stock; the order-confirm -> reserve/commit integration is a separate
 *   follow-up step. InventoryModule itself is untouched.
 */
@Module({
  imports: [PrismaModule, EventBusModule, InventoryModule, DashboardWidgetsModule],
  controllers: [CustomersController, SalesOrdersController],
  providers: [CustomersService, SalesOrdersService, SalesDashboardWidgetsProvider],
  exports: [CustomersService, SalesOrdersService],
})
export class SalesModule {}
