/**
 * Helpers for the `updateField` / `createRecord` handlers, which mutate a
 * Prisma model named by string in the action config. The dynamic delegate
 * access pattern mirrors `core/audit/audit.extension.ts`.
 */

/** Prisma delegate name for a model, e.g. 'Product' -> 'product'. */
export function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
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
