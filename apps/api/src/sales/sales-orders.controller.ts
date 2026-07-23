import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@erp/contracts';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { SalesOrdersService } from './sales-orders.service';
import {
  availabilityQuerySchema,
  createSalesOrderSchema,
  listSalesOrdersQuerySchema,
  updateSalesOrderSchema,
  type AvailabilityQuery,
  type CreateSalesOrderInput,
  type ListSalesOrdersQuery,
  type UpdateSalesOrderInput,
} from './sales-orders.schemas';

/**
 * Sales orders CRUD + status-transition actions + the read-only order-builder
 * availability helper. Per-route `@RequirePermission(...)` (verbs need
 * different permissions).
 *
 * confirm/fulfill/cancel are the integration point with Inventory: they call
 * through to SalesOrdersService, which in turn calls StockService's
 * reserve/commitReservation/release — see sales-orders.service.ts for the
 * full write-up of that boundary.
 *
 * Route order note: `orders/:id/confirm` (3 segments) never collides with
 * `orders/:id` (2 segments) regardless of declaration order; the earlier
 * `availability` vs `orders` note (both top-level literals) is a separate,
 * already-correct case.
 */
@Controller('sales')
export class SalesOrdersController {
  constructor(private readonly orders: SalesOrdersService) {}

  /** GET /sales/availability?productId=&warehouseId= (read-only). */
  @Get('availability')
  @RequirePermission(PERMISSIONS.SALES_ORDER_READ)
  availability(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ) {
    return this.orders.getAvailability(
      user.companyId,
      query.productId,
      query.warehouseId,
    );
  }

  @Get('orders')
  @RequirePermission(PERMISSIONS.SALES_ORDER_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listSalesOrdersQuerySchema)) query: ListSalesOrdersQuery,
  ) {
    return this.orders.list(
      user.companyId,
      query.status,
      query.page,
      query.pageSize,
    );
  }

  @Post('orders')
  @RequirePermission(PERMISSIONS.SALES_ORDER_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSalesOrderSchema)) body: CreateSalesOrderInput,
  ) {
    return this.orders.create(user.companyId, user.userId, body);
  }

  @Get('orders/:id')
  @RequirePermission(PERMISSIONS.SALES_ORDER_READ)
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.get(user.companyId, id);
  }

  @Patch('orders/:id')
  @RequirePermission(PERMISSIONS.SALES_ORDER_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSalesOrderSchema)) body: UpdateSalesOrderInput,
  ) {
    return this.orders.update(user.companyId, user.userId, id, body);
  }

  @Delete('orders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.SALES_ORDER_DELETE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.orders.remove(user.companyId, id);
  }

  /** Reserve stock for every line and transition draft -> confirmed. */
  @Post('orders/:id/confirm')
  @RequirePermission(PERMISSIONS.SALES_ORDER_UPDATE)
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.confirm(user.companyId, user.userId, id);
  }

  /** Commit each line's reservation to an actual deduction; confirmed -> fulfilled. */
  @Post('orders/:id/fulfill')
  @RequirePermission(PERMISSIONS.SALES_ORDER_UPDATE)
  fulfill(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.fulfill(user.companyId, user.userId, id);
  }

  /** Release any reserved stock (if confirmed) and cancel; draft|confirmed -> cancelled. */
  @Post('orders/:id/cancel')
  @RequirePermission(PERMISSIONS.SALES_ORDER_UPDATE)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.cancel(user.companyId, user.userId, id);
  }
}
