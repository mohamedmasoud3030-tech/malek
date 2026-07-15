/**
 * Utilities for calculating prorated rental amounts (التوزيع الزمني للإيجار)
 * and flexible daily/weekly billing schedules.
 */

export type FlexiblePaymentCycle = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export const extendedPaymentCycleLabels: Record<FlexiblePaymentCycle, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  semi_annual: 'نصف سنوي',
  annual: 'سنوي',
};

/**
 * Calculates days in a given year and month.
 */
export function getDaysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

/**
 * Calculates the exact prorated rent amount for a partial month.
 * Formula: (Monthly Rent / Days in Month) * Active Days in Month
 */
export function calculateProratedRent(
  monthlyRent: number,
  startDateStr: string,
  endDateStr: string,
): {
  proratedAmount: number;
  dailyRate: number;
  activeDays: number;
  daysInMonth: number;
} {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const daysInMonth = getDaysInMonth(start.getFullYear(), start.getMonth());
  const dailyRate = monthlyRent / daysInMonth;

  // Inclusive active days
  const timeDiff = end.getTime() - start.getTime();
  const activeDays = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

  const proratedAmount = Number((dailyRate * activeDays).toFixed(3));

  return {
    proratedAmount,
    dailyRate: Number(dailyRate.toFixed(3)),
    activeDays,
    daysInMonth,
  };
}
