import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS, type Paginated } from '@erp/contracts';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { StockService } from './stock.service';
import { InsufficientStockError } from './stock-errors';
import {
  StockReadService,
  type StockItemDto,
  type StockMovementDto,
} from './stock-read.service';
import {
  stockAdjustSchema,
  stockListQuerySchema,
  stockMovementsQuerySchema,
  type StockAdjustInput,
  type StockListQuery,
  type StockMovementsQuery,
} from './inventory.schemas';

/** Response of a successful stock adjustment: the resulting position. */
interface StockAdjustResultDto {
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
}

/**
 * Stock read + adjust API.
 *
 * Reads (the level grid and per-product movement history) require
 * `INVENTORY_PRODUCT_READ`; the adjustment requires the dedicated
 * `INVENTORY_STOCK_ADJUST`. The adjustment delegates to the pre-existing
 * StockService.adjust() (single source of truth for stock mutation) and maps
 * its InsufficientStockError to a 409 Conflict so a would-be-negative
 * adjustment never becomes an unhandled 500.
 */
@Controller('inventory/stock')
export class StockController {
  constructor(
    private readonly stockRead: StockReadService,
    private readonly stock: StockService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVENTORY_PRODUCT_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(stockListQuerySchema)) query: StockListQuery,
  ): Promise<Paginated<StockItemDto>> {
    return this.stockRead.list(user.companyId, query);
  }

  @Post('adjust')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST)
  @HttpCode(HttpStatus.OK)
  async adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(stockAdjustSchema)) body: StockAdjustInput,
  ): Promise<StockAdjustResultDto> {
    // Turn cross-company / non-existent references into a clean 404 before we
    // reach StockService (which trusts its inputs).
    await this.stockRead.ensureProductAndWarehouseInCompany(
      user.companyId,
      body.productId,
      body.warehouseId,
    );

    try {
      const updated = await this.stock.adjust({
        companyId: user.companyId,
        productId: body.productId,
        warehouseId: body.warehouseId,
        delta: body.delta,
        reason: body.reason,
        actorUserId: user.userId,
      });
      return {
        productId: updated.productId,
        warehouseId: updated.warehouseId,
        quantityOnHand: updated.quantityOnHand,
        quantityReserved: updated.quantityReserved,
        available: updated.quantityOnHand - updated.quantityReserved,
      };
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        // A negative adjustment can't drive quantityOnHand below zero.
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Get(':productId/movements')
  @RequirePermission(PERMISSIONS.INVENTORY_PRODUCT_READ)
  movements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Query(new ZodValidationPipe(stockMovementsQuerySchema)) query: StockMovementsQuery,
  ): Promise<Paginated<StockMovementDto>> {
    return this.stockRead.movements(user.companyId, productId, query);
  }
}
