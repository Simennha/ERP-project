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
} from '@nestjs/common';
import { PERMISSIONS } from '@erp/contracts';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CustomersService } from './customers.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from './customers.schemas';

/**
 * Customers CRUD. Unlike WorkflowController (one class-level permission), the
 * different verbs need different permissions, so `@RequirePermission(...)` is
 * applied PER route (SALES_CUSTOMER_READ/CREATE/UPDATE/DELETE).
 */
@Controller('sales/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SALES_CUSTOMER_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.customers.list(user.companyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SALES_CUSTOMER_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput,
  ) {
    return this.customers.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.SALES_CUSTOMER_READ)
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customers.get(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.SALES_CUSTOMER_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.customers.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.SALES_CUSTOMER_DELETE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.customers.remove(user.companyId, id);
  }
}
