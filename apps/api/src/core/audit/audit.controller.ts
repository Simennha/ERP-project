import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { PERMISSIONS, type AuditLogDto } from '@erp/contracts';
import { AuditService } from './audit.service';
import { auditLogQuerySchema, type AuditLogQuery } from './audit.query';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

/**
 * Read access to the audit trail.
 *
 * Protected globally by JwtAuthGuard (authenticated) + PermissionsGuard, which
 * enforces the AUDIT_LOG_READ permission via @RequirePermission. Results are
 * scoped to the caller's company.
 */
@Controller('audit-log')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_LOG_READ)
  async list(
    @CurrentUser() current: AuthenticatedUser | undefined,
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery,
  ): Promise<AuditLogDto[]> {
    if (!current) {
      throw new UnauthorizedException();
    }

    return this.auditService.list({
      companyId: current.companyId,
      entityType: query.entityType,
      entityId: query.entityId,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
