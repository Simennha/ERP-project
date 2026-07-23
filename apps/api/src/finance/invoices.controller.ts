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
  InvoicesService,
  type AvailableSalesOrderDto,
  type InvoiceDto,
} from './invoices.service';
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  updateInvoiceSchema,
  type CreateInvoiceInput,
  type InvoiceListQuery,
  type UpdateInvoiceInput,
} from './finance.schemas';

/**
 * Invoice CRUD API. Authentication is enforced globally by JwtAuthGuard; each
 * route additionally declares the finance permission it needs via
 * `@RequirePermission` (enforced by the global PermissionsGuard). Results are
 * scoped to the caller's company inside InvoicesService.
 *
 * Route order matters: `available-orders` is declared before `:id` so it
 * isn't swallowed by the `:id` route.
 */
@Controller('finance/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.FINANCE_INVOICE_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(invoiceListQuerySchema)) query: InvoiceListQuery,
  ): Promise<Paginated<InvoiceDto>> {
    return this.invoices.list(user.companyId, query);
  }

  @Get('available-orders')
  @RequirePermission(PERMISSIONS.FINANCE_INVOICE_READ)
  listAvailableSalesOrders(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AvailableSalesOrderDto[]> {
    return this.invoices.listAvailableSalesOrders(user.companyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.FINANCE_INVOICE_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
  ): Promise<InvoiceDto> {
    return this.invoices.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.FINANCE_INVOICE_READ)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InvoiceDto> {
    return this.invoices.get(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.FINANCE_INVOICE_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceInput,
  ): Promise<InvoiceDto> {
    return this.invoices.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.FINANCE_INVOICE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.invoices.remove(user.companyId, id);
  }
}
