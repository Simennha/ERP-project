/**
 * Helpers for the `updateField` / `createRecord` handlers, which mutate a
 * Prisma model named by string in the action config. The dynamic delegate
 * access pattern mirrors `core/audit/audit.extension.ts`.
 *
 * SECURITY: these two handlers are the only place in the codebase where a
 * write target (model + field + row) is chosen by string from admin-supplied
 * config rather than fixed application code. Everything below exists to keep
 * that dynamism from becoming a privilege-escalation / cross-tenant-write
 * path — see the three checks in order:
 *   1. `assertAllowedModel` — model must be a business-domain table. Every
 *      security-sensitive table (auth, RBAC, audit, the workflow engine's
 *      own tables) is categorically off limits, no matter the field.
 *   2. `assertAllowedField` — even on an allowed model, a fixed denylist of
 *      field names (id/companyId/passwordHash/audit columns/anything
 *      secret-shaped) can never be written.
 *   3. The handler itself scopes the write's `where` by `companyId` (see
 *      update-field.handler.ts) so a same-model write can't cross tenants.
 */

/** Prisma delegate name for a model, e.g. 'Product' -> 'product'. */
export function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Business-domain models a workflow action may target. Deliberately
 * excludes every auth/RBAC/audit/workflow-engine table (User, Role,
 * Permission, RolePermission, UserRole, Company, Department, AuditLog,
 * EventLog, Notification, WorkflowDefinition, WorkflowAction, WorkflowRun) —
 * a workflow (gated only by `admin:workflow.manage`, not
 * `admin:users.manage`) must never be able to touch those regardless of
 * which field it names.
 */
// Note: SalesOrderLine is deliberately excluded even though it's a business
// table — it has no `companyId` column of its own (only reachable via its
// parent SalesOrder), so the companyId-scoped `updateMany` every handler
// uses below would always fail validation against it. Not a security gap
// (it fails closed), just not worth a confusing always-broken allowlist entry.
const ALLOWED_MODELS = new Set([
  'Product',
  'Warehouse',
  'StockItem',
  'StockMovement',
  'Customer',
  'SalesOrder',
  'Invoice',
  'Employee',
  'PurchaseOrder',
  'Project',
  'Report',
]);

/** Field names never writable via a dynamic workflow action, on any model. */
const FORBIDDEN_FIELDS = new Set([
  'id',
  'companyId',
  'createdById',
  'updatedById',
  'createdAt',
  'updatedAt',
  'passwordHash',
]);

function looksSecretShaped(field: string): boolean {
  return /(hash|secret|token|password)/i.test(field);
}

export function assertAllowedModel(model: string): void {
  if (!ALLOWED_MODELS.has(model)) {
    throw new Error(`workflow action: model "${model}" is not writable by workflow actions`);
  }
}

export function assertAllowedField(field: string): void {
  if (FORBIDDEN_FIELDS.has(field) || looksSecretShaped(field)) {
    throw new Error(`workflow action: field "${field}" is not writable by workflow actions`);
  }
}

/**
 * Resolve the id of the entity a domain event refers to, for dynamic
 * `updateField` writes.
 *
 * v1 supports ONLY models whose triggering event payload carries an obvious
 * entity id under one of two conventional keys, in priority order:
 *   1. `<camelCaseModel>Id`  — e.g. model "Product" -> payload.productId
 *   2. `id`                  — a generic id field
 *
 * This is a deliberately narrow starting point: it covers the real event
 * payload shapes in @erp/contracts (productId, orderId, roleId, userId, ...)
 * without a compiler to verify arbitrary field access against the schema.
 * When no id can be found the handler throws, which the engine records as an
 * action-level error rather than guessing wrong and writing the wrong row.
 */
export function resolveEntityId(
  model: string,
  payload: Record<string, unknown>,
): string | undefined {
  const camel = delegateName(model);
  const candidates = [`${camel}Id`, 'id'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}
