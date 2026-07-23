import type { PermissionKey, RequiredPermission } from '@erp/contracts';

/** A user's effective permissions, as either an array or a Set of key strings. */
export type PermissionSet = ReadonlySet<string> | readonly string[];

/** Coerce a {@link PermissionSet} into a Set for O(1) membership checks. */
export function normalizePermissions(perms: PermissionSet): Set<string> {
  if (perms instanceof Set) {
    return perms as Set<string>;
  }
  return new Set(perms as readonly string[]);
}

/** True if the user holds the single given permission key. */
export function hasPermission(perms: PermissionSet, key: PermissionKey | string): boolean {
  return normalizePermissions(perms).has(key);
}

/** True if the user holds EVERY one of the given permission keys. */
export function hasAllPermissions(
  perms: PermissionSet,
  keys: ReadonlyArray<PermissionKey | string>,
): boolean {
  const set = normalizePermissions(perms);
  return keys.every((k) => set.has(k));
}

/** True if the user holds AT LEAST ONE of the given permission keys. */
export function hasAnyPermission(
  perms: PermissionSet,
  keys: ReadonlyArray<PermissionKey | string>,
): boolean {
  const set = normalizePermissions(perms);
  return keys.some((k) => set.has(k));
}

/**
 * Canonical RBAC check shared by the NestJS `PermissionsGuard` and the React
 * `useAuth().hasPermission` helper so both sides agree on semantics.
 *
 * Default policy: the user must hold ALL required permissions. A single key is
 * treated as a one-element list; an empty list is always allowed.
 */
export function checkRequiredPermissions(
  perms: PermissionSet,
  required: RequiredPermission,
): boolean {
  const keys = Array.isArray(required) ? required : [required];
  if (keys.length === 0) {
    return true;
  }
  const set = normalizePermissions(perms);
  return keys.every((k) => set.has(k));
}
