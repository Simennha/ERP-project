import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { PermissionKey } from '@erp/contracts';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Attaches the set of permission keys a route requires. Enforced by
 * PermissionsGuard.
 *
 * Default policy: the caller must hold ALL listed keys (AND semantics). This
 * matches @erp/auth's `checkRequiredPermissions`. If a future route needs
 * "any of" semantics, add a separate decorator/metadata rather than changing
 * this default.
 *
 * @example @RequirePermission(PERMISSIONS.USERS_MANAGE)
 */
export const RequirePermission = (...keys: PermissionKey[]): CustomDecorator =>
  SetMetadata(PERMISSIONS_KEY, keys);
