import { roundMoney } from '@/lib/money';

/**
 * Finance read-model arithmetic. Money precision is owned by `@/lib/money`
 * (OMR = 3 decimals, `roundMoney` mirrors the server `public._r3`); this module
 * only coerces unknown values to finite numbers and applies that precision to
 * the results, so callers no longer need to patch binary float drift themselves.
 */
export function toFinancialNumber(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function getSafeRemainingAmount(amount: unknown, paidAmount: unknown): number {
  return Math.max(0, roundMoney(toFinancialNumber(amount) - toFinancialNumber(paidAmount)));
}

export function sumFinancialValues(values: unknown[]): number {
  const total = values.reduce<number>((sum, value) => sum + toFinancialNumber(value), 0);
  // `|| 0` normalizes a rounded negative zero (e.g. -0.0001) to +0.
  return roundMoney(total) || 0;
}
