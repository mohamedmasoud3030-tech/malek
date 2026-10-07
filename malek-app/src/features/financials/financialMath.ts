export function toFinancialNumber(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function getSafeRemainingAmount(amount: unknown, paidAmount: unknown): number {
  return Math.max(0, toFinancialNumber(amount) - toFinancialNumber(paidAmount));
}

export function sumFinancialValues(values: unknown[]): number {
  return values.reduce<number>((total, value) => total + toFinancialNumber(value), 0);
}
