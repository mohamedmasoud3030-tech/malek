import { describe, expect, it } from 'vitest';
import { buildMasterLeaseSchedule } from './master-lease-schedule';

describe('buildMasterLeaseSchedule', () => {
  it('builds a balanced monthly liability and ROU depreciation schedule', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: Array.from({ length: 12 }, (_, index) => ({
        period: index + 1,
        amountMinor: 10_000,
      })),
      annualDiscountRateBps: 600,
      periodsPerYear: 12,
    });

    expect(schedule.initialLiabilityMinor).toBeGreaterThan(0);
    expect(schedule.rows).toHaveLength(12);
    expect(schedule.rows[0]!.openingLiabilityMinor).toBe(schedule.initialLiabilityMinor);
    expect(schedule.rows.at(-1)!.closingLiabilityMinor).toBe(0);
    expect(schedule.rows.at(-1)!.closingRouAssetMinor).toBe(0);

    for (const row of schedule.rows) {
      expect(row.openingLiabilityMinor + row.interestMinor - row.paymentMinor).toBe(
        row.closingLiabilityMinor,
      );
      expect(row.principalMinor).toBe(row.paymentMinor - row.interestMinor);
      expect(row.closingLiabilityMinor).toBeGreaterThanOrEqual(0);
      expect(row.closingRouAssetMinor).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([1, 12, 24])('settles a %i-period lease through the final payment', (periods) => {
    const schedule = buildMasterLeaseSchedule({
      payments: Array.from({ length: periods }, (_, index) => ({
        period: index + 1,
        amountMinor: 10_000,
      })),
      annualDiscountRateBps: 600,
      periodsPerYear: 12,
    });
    const last = schedule.rows.at(-1)!;

    expect(last.paymentMinor).toBe(last.openingLiabilityMinor + last.interestMinor);
    expect(last.openingLiabilityMinor + last.interestMinor - last.paymentMinor).toBe(
      last.closingLiabilityMinor,
    );
    expect(last.principalMinor).toBe(last.paymentMinor - last.interestMinor);
    expect(last.closingLiabilityMinor).toBe(0);
  });

  it('includes direct costs and prepayments and deducts incentives from the ROU asset only', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: [
        { period: 1, amountMinor: 50_000 },
        { period: 2, amountMinor: 50_000 },
      ],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
      initialDirectCostsMinor: 3_000,
      prepaymentsMinor: 5_000,
      incentivesMinor: 2_000,
    });

    expect(schedule.initialLiabilityMinor).toBe(100_000);
    expect(schedule.initialRouAssetMinor).toBe(106_000);
    expect(schedule.rows.at(-1)!.closingLiabilityMinor).toBe(0);
    expect(schedule.rows.at(-1)!.closingRouAssetMinor).toBe(0);
  });

  it('supports irregular payment periods without inventing missing payments', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: [
        { period: 1, amountMinor: 20_000 },
        { period: 3, amountMinor: 20_000 },
      ],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    });

    expect(schedule.rows).toHaveLength(3);
    expect(schedule.rows[1]!.paymentMinor).toBe(0);
    expect(schedule.rows.at(-1)!.closingLiabilityMinor).toBe(0);
  });

  it('rejects unsafe or ambiguous inputs', () => {
    expect(() =>
      buildMasterLeaseSchedule({ payments: [], annualDiscountRateBps: 0, periodsPerYear: 12 }),
    ).toThrow('payments must contain at least one period');

    expect(() =>
      buildMasterLeaseSchedule({
        payments: [
          { period: 1, amountMinor: 1_000 },
          { period: 1, amountMinor: 1_000 },
        ],
        annualDiscountRateBps: 0,
        periodsPerYear: 12,
      }),
    ).toThrow('duplicate payment period');

    expect(() =>
      buildMasterLeaseSchedule({
        payments: [{ period: 1, amountMinor: 1.5 }],
        annualDiscountRateBps: 0,
        periodsPerYear: 12,
      }),
    ).toThrow('payment amount must be a non-negative safe integer in minor units');
  });
});
