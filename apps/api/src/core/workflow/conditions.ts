import jsonLogic from 'json-logic-js';

/**
 * Evaluate a WorkflowDefinition's `conditionsJson` (a json-logic-js rule tree)
 * against an event payload.
 *
 * SAFETY: json-logic-js is a data-only interpreter — it NEVER uses `eval` or
 * executes arbitrary code, only the fixed set of json-logic operators applied
 * to the supplied data. This is the whole reason the conditions are stored as
 * json-logic rather than as a code string.
 *
 * A null / undefined / empty-object condition means "no extra condition beyond
 * the trigger event matching", so it returns `true`.
 */
export function evaluateConditions(
  conditions: unknown,
  payload: Record<string, unknown>,
): boolean {
  if (conditions === null || conditions === undefined) {
    return true;
  }
  if (
    typeof conditions === 'object' &&
    !Array.isArray(conditions) &&
    Object.keys(conditions as Record<string, unknown>).length === 0
  ) {
    return true;
  }
  return Boolean(jsonLogic.apply(conditions, payload));
}
