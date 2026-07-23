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
  type PaginationQuery,
} from '@erp/contracts';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { WorkflowService } from './workflow.service';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
} from './workflow.schemas';

/**
 * Admin/configuration API for workflow automations (no admin UI this phase).
 *
 * `@RequirePermission(WORKFLOW_MANAGE)` is applied at the CLASS level, so it
 * covers EVERY route including `GET :id/runs` — the run history is a
 * config/debugging surface, not per-user personal data (contrast with the
 * notifications controller, which needs no extra permission). The global
 * PermissionsGuard reads class-level metadata via `getAllAndOverride`.
 *
 * Request bodies are validated by zod schemas colocated in this module
 * (workflow.schemas.ts) rather than in `@erp/contracts`, because they are
 * API-input shapes specific to these endpoints, not cross-app DTOs.
 */
@Controller('workflows')
@RequirePermission(PERMISSIONS.WORKFLOW_MANAGE)
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workflows.list(user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWorkflowSchema)) body: CreateWorkflowInput,
  ) {
    return this.workflows.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workflows.get(user.companyId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWorkflowSchema)) body: UpdateWorkflowInput,
  ) {
    return this.workflows.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.workflows.remove(user.companyId, id);
  }

  @Get(':id/runs')
  listRuns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.workflows.listRuns(
      user.companyId,
      id,
      query.page,
      query.pageSize,
    );
  }
}
