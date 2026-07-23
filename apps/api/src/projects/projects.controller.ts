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
import { ProjectsService, type ProjectDto } from './projects.service';
import {
  createProjectSchema,
  projectListQuerySchema,
  updateProjectSchema,
  type CreateProjectInput,
  type ProjectListQuery,
  type UpdateProjectInput,
} from './projects.schemas';

/**
 * Project CRUD API. Mounted at the single top-level segment `/projects`
 * (like `notifications`/`workflows`) rather than nested under a module-name
 * prefix — this module has exactly one resource, and the resource name IS the
 * module name, so `/projects/projects` would be redundant. Authentication is
 * enforced globally by JwtAuthGuard; each route additionally declares the
 * projects permission it needs via `@RequirePermission` (enforced by the
 * global PermissionsGuard). Results are scoped to the caller's company inside
 * ProjectsService.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECTS_PROJECT_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(projectListQuerySchema)) query: ProjectListQuery,
  ): Promise<Paginated<ProjectDto>> {
    return this.projects.list(user.companyId, query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROJECTS_PROJECT_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ): Promise<ProjectDto> {
    return this.projects.create(user.companyId, user.userId, body);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROJECTS_PROJECT_READ)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ProjectDto> {
    return this.projects.get(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PROJECTS_PROJECT_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ): Promise<ProjectDto> {
    return this.projects.update(user.companyId, user.userId, id, body);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PROJECTS_PROJECT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.projects.remove(user.companyId, id);
  }
}
