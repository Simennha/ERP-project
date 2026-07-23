/**
 * Local ambient declaration for `json-logic-js`, which ships no types of its
 * own. Declared here (rather than depending on `@types/json-logic-js`) so the
 * type surface is pinned to exactly what this module uses and does not depend
 * on an external @types version that can drift. Only `apply()` is used by the
 * workflow engine; the rest of the runtime API is declared for completeness.
 */
declare module 'json-logic-js' {
  /** Evaluate a json-logic rule tree against a data object. */
  export function apply(rule: unknown, data?: unknown): unknown;
  /** Register a custom operation (unused here, declared for completeness). */
  export function add_operation(
    name: string,
    fn: (...args: unknown[]) => unknown,
  ): void;
  /** Remove a previously-registered custom operation. */
  export function rm_operation(name: string): void;
  /** List the data keys a rule references. */
  export function uses_data(rule: unknown): string[];
  /** Whether the argument is a json-logic rule. */
  export function is_logic(rule: unknown): boolean;

  const jsonLogic: {
    apply: typeof apply;
    add_operation: typeof add_operation;
    rm_operation: typeof rm_operation;
    uses_data: typeof uses_data;
    is_logic: typeof is_logic;
  };

  export default jsonLogic;
}
