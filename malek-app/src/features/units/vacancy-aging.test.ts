import { describe, expect, it } from 'vitest';
import {
  buildVacancyAgingBuckets,
  vacancyAgingBucketForDays,
  vacancyAgingBucketOrder,
  type VacantUnitAnalyticsRow,
} from './vacancy-analytics';

function makeRow(daysVacant: number): VacantUnitAnalyticsRow {
  return {
    unitId: `unit-${daysVacant}`,
    propertyId: 'property-1',
    unitNumber: String(daysVacant),
    propertyTitle: 'برج الاختبار',
    referenceRent: null,
    lastContractEndDate: null,
    vacancySince: '2026-01-01',
    vacancySinceSource: 'unit_created',
    daysVacant,
  };
}

describe('vacancy aging buckets', () => {
  it('maps days vacant into the fixed presentation lanes', () => {
    expect(vacancyAgingBucketForDays(0)).toBe('days_0_15');
    expect(vacancyAgingBucketForDays(15)).toBe('days_0_15');
    expect(vacancyAgingBucketForDays(16)).toBe('days_16_30');
    expect(vacancyAgingBucketForDays(30)).toBe('days_16_30');
    expect(vacancyAgingBucketForDays(31)).toBe('days_31_60');
    expect(vacancyAgingBucketForDays(60)).toBe('days_31_60');
    expect(vacancyAgingBucketForDays(61)).toBe('days_61_plus');
    expect(vacancyAgingBucketForDays(400)).toBe('days_61_plus');
  });

  it('counts rows per lane without losing or inventing units', () => {
    const buckets = buildVacancyAgingBuckets([
      makeRow(3),
      makeRow(15),
      makeRow(29),
      makeRow(45),
      makeRow(60),
      makeRow(61),
      makeRow(120),
    ]);
    expect(buckets.days_0_15).toBe(2);
    expect(buckets.days_16_30).toBe(1);
    expect(buckets.days_31_60).toBe(2);
    expect(buckets.days_61_plus).toBe(2);
    const total = vacancyAgingBucketOrder.reduce((sum, key) => sum + buckets[key], 0);
    expect(total).toBe(7);
  });

  it('stays all-zero for an empty portfolio', () => {
    expect(buildVacancyAgingBuckets([])).toEqual({
      days_0_15: 0,
      days_16_30: 0,
      days_31_60: 0,
      days_61_plus: 0,
    });
  });
});
