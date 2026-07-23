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
import { EmployeesService, type EmployeeDto } from './employees.service';
import {
  createEmployeeSchema,
  employeeListQuerySchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type EmployeeListQuery,
  type UpdateEmployeeInput,
} from './hr.schemas';

/**
 * Employee CRUD API. Authentication is enforced globally by JwtAuthGuard; each
 * route additionally declares the hr permission it needs via
 * `@RequirePermission` (enforced by the global PermissionsGuard). Results are
 * scoped to the caller's company inside EmployeesService.
 */
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.HR_EMPLOYEE_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(employeeListQuerySchema)) query: EmployeeListQuery,
  ): Promise<Paginated<EmployeeDto>> {
    return this.employees.list(user.companyId, query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.HR_EMPLOYEE_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createEmployeeSchema)) body: CreateEmployeeInput,
  ): Promise<EmployeeDto> {
    return this.employees.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.HR_EMPLOYEE_READ)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EmployeeDto> {
    return this.employees.get(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.HR_EMPLOYEE_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateEmployeeSchema)) body: UpdateEmployeeInput,
  ): Promise<EmployeeDto> {
    return this.employees.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.HR_EMPLOYEE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.employees.remove(user.companyId, id);
  }
}
