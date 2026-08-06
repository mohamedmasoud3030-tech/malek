import { describe, expect, it } from 'vitest';
import { buildMasterLeaseSchedule } from './master-lease-schedule';
import { buildMasterLeaseDisclosure } from './master-lease-disclosures';

describe('buildMasterLeaseDisclosure', () => {
  it('reconciles liability, cash, interest and ROU movements', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: Array.from({ length: 24 }, (_, index) => ({
        period: index + 1,
        amountMinor: 10_000,
      })),
      annualDiscountRateBps: 600,
      periodsPerYear: 12,
    });

    const disclosure = buildMasterLeaseDisclosure(schedule, 12);

    expect(disclosure.openingLiabilityMinor + disclosure.interestExpenseMinor - disclosure.cashPaymentsMinor)
      .toBe(disclosure.closingLiabilityMinor);
    expect(disclosure.principalReductionMinor)
      .toBe(disclosure.cashPaymentsMinor - disclosure.interestExpenseMinor);
    expect(disclosure.currentLiabilityMinor + disclosure.nonCurrentLiabilityMinor)
      .toBe(disclosure.openingLiabilityMinor);
    expect(disclosure.closingRouAssetMinor).toBe(0);
    expect(disclosure.rouDepreciationMinor).toBe(schedule.initialRouAssetMinor);
  });

  it('supports a zero-period current classification without losing the total', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: [{ period: 1, amountMinor: 50_000 }],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    });

    const disclosure = buildMasterLeaseDisclosure(schedule, 0);
    expect(disclosure.currentLiabilityMinor).toBe(0);
    expect(disclosure.nonCurrentLiabilityMinor).toBe(disclosure.openingLiabilityMinor);
  });

  it('rejects invalid classification windows', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: [{ period: 1, amountMinor: 50_000 }],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    });

    expect(() => buildMasterLeaseDisclosure(schedule, -1)).toThrow(
      'currentPeriodCount must be a non-negative integer',
    );
  });
});
