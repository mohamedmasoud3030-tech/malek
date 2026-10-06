/**
 * Currency fraction precision — the ONLY minor-unit table the document
 * platform uses (ISO 4217).
 *
 * Precision is DERIVED from the real `company_settings.currency` code at
 * render time; nothing is hard-coded to OMR's three decimals. An unknown
 * or blank code falls back to the common two-decimal convention rather
 * than silently formatting with three.
 */

/** ISO 4217 currencies with three fractional digits. */
const THREE_DECIMAL_CURRENCY_CODES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** ISO 4217 currencies with zero fractional digits. */
const ZERO_DECIMAL_CURRENCY_CODES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/**
 * Fraction digits for a currency code: 3 for three-decimal currencies
 * (OMR/KWD/BHD/TND/JOD/IQD/LYD), 0 for zero-decimal currencies (JPY/…),
 * and 2 for every common two-decimal currency (USD/EUR/EGP/SAR/…).
 */
export function currencyFractionDigits(currencyCode: string | null | undefined): 0 | 2 | 3 {
  const normalized = currencyCode?.trim().toUpperCase() ?? '';
  if (THREE_DECIMAL_CURRENCY_CODES.has(normalized)) return 3;
  if (ZERO_DECIMAL_CURRENCY_CODES.has(normalized)) return 0;
  return 2;
}
