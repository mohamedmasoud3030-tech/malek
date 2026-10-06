import { describe, expect, it } from 'vitest';
import { calculateDeferredRevenueSchedule } from './deferred-revenue-service';

describe('calculateDeferredRevenueSchedule', () => {
  const collection = {
    contractId: 'contract-1',
    tenantName: 'مستأجر',
    propertyTitle: 'عقار',
    amount: 1200,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  it('does not recognize revenue before the contract starts', () => {
    const report = calculateDeferredRevenueSchedule([collection], '2025-12-31');

    expect(report.totalUpfrontCollections).toBe(1200);
    expect(report.totalRecognizedRevenueCurrentMonth).toBe(0);
    expect(report.totalRecognizedRevenueToDate).toBe(0);
    expect(report.totalDeferredLiability).toBe(1200);
  });

  it('recognizes one monthly portion during the first contract month', () => {
    const report = calculateDeferredRevenueSchedule([collection], '2026-01-15');

    expect(report.totalRecognizedRevenueCurrentMonth).toBe(100);
    expect(report.totalRecognizedRevenueToDate).toBe(100);
    expect(report.totalDeferredLiability).toBe(1100);
    expect(report.schedules[0]).toMatchObject({ totalMonths: 12, elapsedMonths: 1 });
  });

  it('fully recognizes the amount after the contract ends without recognizing a new current month', () => {
    const report = calculateDeferredRevenueSchedule([collection], '2027-01-01');

    expect(report.totalRecognizedRevenueCurrentMonth).toBe(0);
    expect(report.totalRecognizedRevenueToDate).toBe(1200);
    expect(report.totalDeferredLiability).toBe(0);
  });

  it('ignores invalid periods and non-positive collections', () => {
    const report = calculateDeferredRevenueSchedule([
      { ...collection, contractId: 'invalid-period', startDate: '2026-12-31', endDate: '2026-01-01' },
      { ...collection, contractId: 'invalid-amount', amount: 0 },
    ], '2026-06-01');

    expect(report.schedules).toEqual([]);
    expect(report.totalUpfrontCollections).toBe(0);
  });
});
