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
import {
  PERMISSIONS,
  paginationQuerySchema,
  type Paginated,
  type PaginationQuery,
} from '@erp/contracts';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { WarehousesService, type WarehouseDto } from './warehouses.service';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
} from './inventory.schemas';

/**
 * Warehouse CRUD API. A single `INVENTORY_WAREHOUSE_MANAGE` permission is
 * declared at the CLASS level and therefore gates EVERY route, reads included —
 * warehouses are a small admin-configured list with no separate read key.
 */
@Controller('inventory/warehouses')
@RequirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE)
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<WarehouseDto>> {
    return this.warehouses.list(user.companyId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWarehouseSchema)) body: CreateWarehouseInput,
  ): Promise<WarehouseDto> {
    return this.warehouses.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WarehouseDto> {
    return this.warehouses.get(user.companyId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWarehouseSchema)) body: UpdateWarehouseInput,
  ): Promise<WarehouseDto> {
    return this.warehouses.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.warehouses.remove(user.companyId, id);
  }
}
