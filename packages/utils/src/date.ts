import { DEFAULT_LOCALE } from './currency';

export type DateInput = Date | string | number;

/** Coerce a Date | ISO string | epoch-ms into a Date; throws on invalid input. */
export function toDate(value: DateInput): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`Invalid date input: ${String(value)}`);
  }
  return d;
}

/** True if the value can be parsed into a valid Date. */
export function isValidDate(value: DateInput): boolean {
  try {
    toDate(value);
    return true;
  } catch {
    return false;
  }
}

/** Format as a localized date, e.g. "Jul 23, 2026". */
export function formatDate(value: DateInput, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(toDate(value));
}

/** Format as a localized date + time, e.g. "Jul 23, 2026, 2:30 PM". */
export function formatDateTime(value: DateInput, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(toDate(value));
}

/** Return the `YYYY-MM-DD` (UTC) portion of a date. */
export function toISODateString(value: DateInput): string {
  return toDate(value).toISOString().slice(0, 10);
}

/** Full ISO-8601 timestamp string (UTC). */
export function toISOString(value: DateInput): string {
  return toDate(value).toISOString();
}
