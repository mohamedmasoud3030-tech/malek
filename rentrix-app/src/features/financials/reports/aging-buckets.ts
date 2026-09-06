import { toFinancialNumber } from '../financialMath';

/**
 * Canonical arrears aging vocabulary (pure — no data access).
 *
 * Every arrears surface (Money arrears workflow, dashboard collections,
 * printed aged-arrears documents) labels a bucket through this module —
 * never through a local copy. Bucket boundaries are the server's fixed
 * cohorts; `getAgingBucketKeyFromDaysOverdue` only re-derives the key for
 * rows that arrive without one.
 */
export type AgingBucketKey = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus';

export const agingBucketLabels: Readonly<Record<AgingBucketKey, string>> = {
  current: 'غير متأخر',
  days_1_30: '1–30 يوم',
  days_31_60: '31–60 يوم',
  days_61_90: '61–90 يوم',
  days_90_plus: 'أكثر من 90 يوم',
};

export const agingBucketOrder: readonly AgingBucketKey[] = ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'];

export function getAgingBucketLabel(bucket: AgingBucketKey) {
  return agingBucketLabels[bucket];
}

export function getAgingBucketKeyFromDaysOverdue(daysOverdue: number | null | undefined): AgingBucketKey {
  const safeDays = toFinancialNumber(daysOverdue);
  if (safeDays <= 0) return 'current';
  if (safeDays <= 30) return 'days_1_30';
  if (safeDays <= 60) return 'days_31_60';
  if (safeDays <= 90) return 'days_61_90';
  return 'days_90_plus';
}
