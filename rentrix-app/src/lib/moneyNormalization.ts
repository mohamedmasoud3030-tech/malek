export type MoneyNormalizationOptions = Readonly<{
  fallback?: number;
  min?: number;
  max?: number;
}>;

const DEFAULT_FALLBACK = 0;
const PLAIN_MONEY_INPUT_PATTERN = /^[+-]?\d+(?:\.\d+)?$/;
const GROUPED_MONEY_INPUT_PATTERN = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

function getFiniteFallback(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : DEFAULT_FALLBACK;
}

function clampMoneyValue(value: number, options: MoneyNormalizationOptions): number {
  const minimum = Number.isFinite(options.min) ? Number(options.min) : Number.NEGATIVE_INFINITY;
  const maximum = Number.isFinite(options.max) ? Number(options.max) : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeMoneyString(value: string): string | null {
  const input = value.trim();

  if (input.length === 0) {
    return '';
  }

  if (PLAIN_MONEY_INPUT_PATTERN.test(input)) {
    return input;
  }

  if (GROUPED_MONEY_INPUT_PATTERN.test(input)) {
    return input.replaceAll(',', '');
  }

  return null;
}

export function normalizeMoneyNumber(value: unknown, options: MoneyNormalizationOptions = {}): number {
  const fallback = getFiniteFallback(options.fallback);
  const numericValue = typeof value === 'number' ? value : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : fallback;
  return clampMoneyValue(safeValue, options);
}

export function normalizeMoneyInput(value: unknown, options: MoneyNormalizationOptions = {}): number {
  if (typeof value === 'string') {
    const normalizedInput = normalizeMoneyString(value);
    if (normalizedInput === null || normalizedInput.length === 0) {
      return normalizeMoneyNumber(options.fallback, options);
    }
    return normalizeMoneyNumber(normalizedInput, options);
  }

  return normalizeMoneyNumber(value, options);
}
