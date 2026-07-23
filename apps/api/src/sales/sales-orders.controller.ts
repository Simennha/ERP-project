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
 * Sales orders CRUD + the read-only order-builder availability helper. Per-route
 * `@RequirePermission(...)` (verbs need different permissions).
 *
 * NO confirm/fulfill/cancel routes exist here by design: status transitions and
 * the stock-reservation integration are a deliberately separate follow-up step.
 *
 * Route order note: the static `availability` and `orders` paths are declared
 * before the parameterised `orders/:id` so there is no ambiguity.
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
}
