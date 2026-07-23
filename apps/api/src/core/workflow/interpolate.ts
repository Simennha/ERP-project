/**
 * Minimal `{{fieldName}}` substitution for workflow action configs.
 *
 * This is deliberately NOT a template engine: only TOP-LEVEL keys of the event
 * payload are substituted (a documented v1 simplification). An unknown
 * placeholder is left untouched so a misconfigured template shows up in the
 * output instead of being silently blanked.
 */
export function interpolate(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(
    /\{\{\s*([A-Za-z0-9_$]+)\s*\}\}/g,
    (match: string, key: string): string => {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) {
        return match;
      }
      const value = payload[key];
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    },
  );
}

/**
 * Shallow interpolation of every top-level string value in a record; non-string
 * values are passed through untouched (matches the contract's note that
 * `createRecord` interpolation applies to string values only).
 */
export function interpolateRecord(
  data: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = typeof value === 'string' ? interpolate(value, payload) : value;
  }
  return out;
}

/** Coerce an event payload (typed `unknown`) into a plain string-keyed record. */
export function asPayloadRecord(payload: unknown): Record<string, unknown> {
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}
