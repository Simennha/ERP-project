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
import { PERMISSIONS, paginationQuerySchema, type Paginated, type PaginationQuery, type ReportResult } from '@erp/contracts';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ReportsService, type ReportDto } from './reports.service';
import {
  createReportSchema,
  updateReportSchema,
  type CreateReportInput,
  type UpdateReportInput,
} from './reporting.schemas';

/**
 * Report CRUD + run API. Authentication is enforced globally by JwtAuthGuard;
 * each route additionally declares the reporting permission it needs via
 * `@RequirePermission`. Results are scoped to the caller's company inside
 * ReportsService.
 */
@Controller('reporting/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTING_REPORT_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<ReportDto>> {
    return this.reports.list(user.companyId, query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.REPORTING_REPORT_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createReportSchema)) body: CreateReportInput,
  ): Promise<ReportDto> {
    return this.reports.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.REPORTING_REPORT_READ)
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ReportDto> {
    return this.reports.get(user.companyId, id);
  }

  @Get(':id/run')
  @RequirePermission(PERMISSIONS.REPORTING_REPORT_READ)
  run(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ReportResult> {
    return this.reports.run(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.REPORTING_REPORT_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateReportSchema)) body: UpdateReportInput,
  ): Promise<ReportDto> {
    return this.reports.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.REPORTING_REPORT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.reports.remove(user.companyId, id);
  }
}
