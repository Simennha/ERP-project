/** Default locale/currency used when callers do not specify one. */
export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_CURRENCY = 'USD';

/**
 * Format a decimal amount (major units, e.g. dollars) as a currency string.
 *
 * @example formatCurrency(1234.5) // "$1,234.50"
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format an integer amount stored in minor units (e.g. cents) as currency.
 * Storing money as integers avoids floating-point drift; this is the
 * recommended persistence format for later Finance/Sales modules.
 *
 * @example formatCurrencyFromMinorUnits(123450) // "$1,234.50"
 */
export function formatCurrencyFromMinorUnits(
  minorUnits: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
  fractionDigits = 2,
): string {
  const major = minorUnits / 10 ** fractionDigits;
  return formatCurrency(major, currency, locale);
}

/** Convert major units (e.g. 12.34) to minor units (e.g. 1234), rounded. */
export function toMinorUnits(amount: number, fractionDigits = 2): number {
  return Math.round(amount * 10 ** fractionDigits);
}

/** Convert minor units (e.g. 1234) to major units (e.g. 12.34). */
export function fromMinorUnits(minorUnits: number, fractionDigits = 2): number {
  return minorUnits / 10 ** fractionDigits;
}
