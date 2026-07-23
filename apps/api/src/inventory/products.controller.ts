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
import { PERMISSIONS, type Paginated } from '@erp/contracts';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ProductsService, type ProductDto } from './products.service';
import {
  createProductSchema,
  productListQuerySchema,
  updateProductSchema,
  type CreateProductInput,
  type ProductListQuery,
  type UpdateProductInput,
} from './inventory.schemas';

/**
 * Product CRUD API. Authentication is enforced globally by JwtAuthGuard; each
 * route additionally declares the inventory permission it needs via
 * `@RequirePermission` (enforced by the global PermissionsGuard). Results are
 * scoped to the caller's company inside ProductsService.
 */
@Controller('inventory/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVENTORY_PRODUCT_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery,
  ): Promise<Paginated<ProductDto>> {
    return this.products.list(user.companyId, query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.INVENTORY_PRODUCT_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
  ): Promise<ProductDto> {
    return this.products.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_PRODUCT_READ)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ProductDto> {
    return this.products.get(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_PRODUCT_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ): Promise<ProductDto> {
    return this.products.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_PRODUCT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.products.remove(user.companyId, id);
  }
}
