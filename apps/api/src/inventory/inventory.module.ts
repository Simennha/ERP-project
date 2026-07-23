import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../core/event-bus/event-bus.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { StockService } from './stock.service';
import { StockReadService } from './stock-read.service';
import { ProductsService } from './products.service';
import { WarehousesService } from './warehouses.service';
import { ProductsController } from './products.controller';
import { WarehousesController } from './warehouses.controller';
import { StockController } from './stock.controller';
import { InventoryDashboardWidgetsProvider } from './inventory-dashboard-widgets.provider';

/**
 * Inventory module.
 *
 * {@link StockService} remains the single write-path for stock mutation (the
 * reserve/commitReservation/release/adjust contract Sales depends on) and is
 * still exported so Sales (and any other module) can inject it directly.
 *
 * Layered on top in this pass:
 *  - Product / Warehouse CRUD ({@link ProductsController} / {@link WarehousesController}).
 *  - Read-only stock queries + a stock-adjust endpoint ({@link StockController}),
 *    where adjust delegates to StockService.adjust() — no new mutation path.
 */
@Module({
  imports: [PrismaModule, EventBusModule, DashboardWidgetsModule],
  controllers: [ProductsController, WarehousesController, StockController],
  providers: [
    StockService,
    StockReadService,
    ProductsService,
    WarehousesService,
    InventoryDashboardWidgetsProvider,
  ],
  exports: [StockService],
})
export class InventoryModule {}
