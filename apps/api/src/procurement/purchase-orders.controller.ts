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
import {
  PurchaseOrdersService,
  type PurchaseOrderDto,
  type PurchaseOrderListItemDto,
} from './purchase-orders.service';
import {
  createPurchaseOrderSchema,
  purchaseOrderListQuerySchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema,
  type CreatePurchaseOrderInput,
  type PurchaseOrderListQuery,
  type ReceivePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
} from './procurement.schemas';

/**
 * PurchaseOrder CRUD + status-transition actions API. Authentication is
 * enforced globally by JwtAuthGuard; each route additionally declares the
 * procurement permission it needs via `@RequirePermission` (enforced by the
 * global PermissionsGuard). Results are scoped to the caller's company inside
 * PurchaseOrdersService.
 *
 * submit/receive/cancel are the integration point with Inventory: receive()
 * calls through to PurchaseOrdersService, which in turn calls
 * StockService.adjust() — see purchase-orders.service.ts for the full
 * write-up (the inbound mirror of SalesOrdersController's confirm/fulfill/cancel).
 */
@Controller('procurement/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(purchaseOrderListQuerySchema)) query: PurchaseOrderListQuery,
  ): Promise<Paginated<PurchaseOrderListItemDto>> {
    return this.purchaseOrders.list(user.companyId, query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPurchaseOrderSchema)) body: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    return this.purchaseOrders.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PurchaseOrderDto> {
    return this.purchaseOrders.get(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePurchaseOrderSchema)) body: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    return this.purchaseOrders.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.purchaseOrders.remove(user.companyId, id);
  }

  /** Send a draft PO to the vendor: draft -> submitted. */
  @Post(':id/submit')
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_UPDATE)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PurchaseOrderDto> {
    return this.purchaseOrders.submit(user.companyId, user.userId, id);
  }

  /** Receive goods against one or more lines (partial or full); adjusts real stock. */
  @Post(':id/receive')
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_UPDATE)
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(receivePurchaseOrderSchema)) body: ReceivePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    return this.purchaseOrders.receive(user.companyId, user.userId, id, body);
  }

  /** Cancel a draft or submitted PO; not reachable once any goods have been received. */
  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_UPDATE)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PurchaseOrderDto> {
    return this.purchaseOrders.cancel(user.companyId, user.userId, id);
  }
}
