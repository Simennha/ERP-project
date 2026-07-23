import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PermissionKey } from '@erp/contracts';
import { checkRequiredPermissions } from '@erp/auth';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { UsersService } from '../../users/users.service';

/**
 * Global RBAC guard. Runs AFTER JwtAuthGuard (registration order in
 * AppModule), so req.user is already populated for protected routes.
 *
 * For routes annotated with @RequirePermission(...), it loads the caller's
 * effective permission set (UserRole -> RolePermission -> Permission) and
 * enforces the default policy: ALL required keys must be present. Routes
 * without the decorator are allowed through.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const permissions = await this.usersService.getEffectivePermissions(user.userId);
    if (!checkRequiredPermissions(permissions, required)) {
      throw new ForbiddenException('Missing required permission');
    }

    return true;
  }
}
