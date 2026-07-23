import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../core/event-bus/event-bus.module';
import { StockService } from './stock.service';

/**
 * Inventory module. Ships with just {@link StockService} for now (the
 * reserve/commitReservation/release/adjust contract Sales depends on) —
 * Product/Warehouse CRUD controllers and read endpoints are added on top of
 * this same module in a follow-up pass.
 *
 * Exports StockService so Sales (and any other module) can inject it directly.
 */
@Module({
  imports: [PrismaModule, EventBusModule],
  providers: [StockService],
  exports: [StockService],
})
export class InventoryModule {}
