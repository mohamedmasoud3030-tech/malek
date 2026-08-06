import { describe, expect, it } from 'vitest';
import { remeasureMasterLease } from './master-lease-remeasurement';
import { buildMasterLeaseRemeasurementPostingIntent } from './master-lease-remeasurement-posting-intents';

const accounts = {
  rouAsset: '1600',
  leaseLiability: '2500',
  terminationGain: '4400',
  terminationLoss: '6400',
} as const;

function totals(lines: readonly { debitMinor: number; creditMinor: number }[]) {
  return lines.reduce(
    (sum, line) => ({
      debit: sum.debit + line.debitMinor,
      credit: sum.credit + line.creditMinor,
    }),
    { debit: 0, credit: 0 },
  );
}

describe('buildMasterLeaseRemeasurementPostingIntent', () => {
  it('creates a balanced ordinary remeasurement intent', () => {
    const result = remeasureMasterLease({
      leaseId: 'lease-1',
      effectivePeriod: 3,
      carryingLiabilityMinor: 70_000,
      carryingRouAssetMinor: 65_000,
      revisedPayments: [
        { period: 1, amountMinor: 40_000 },
        { period: 2, amountMinor: 40_000 },
      ],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    });

    const intent = buildMasterLeaseRemeasurementPostingIntent({
      leaseId: 'lease-1',
      effectivePeriod: 3,
      result,
      accounts,
    });

    expect(intent.eventId).toBe(result.eventId);
    expect(totals(intent.lines).debit).toBe(totals(intent.lines).credit);
    expect(intent.lines).toEqual([
      { accountCode: '1600', debitMinor: 10_000, creditMinor: 0 },
      { accountCode: '2500', debitMinor: 0, creditMinor: 10_000 },
    ]);
  });

  it('includes termination gain for a partial scope reduction', () => {
    const result = remeasureMasterLease({
      leaseId: 'lease-2',
      effectivePeriod: 4,
      carryingLiabilityMinor: 100_000,
      carryingRouAssetMinor: 90_000,
      revisedPayments: [
        { period: 1, amountMinor: 40_000 },
        { period: 2, amountMinor: 40_000 },
      ],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
      scopeReductionBps: 5_000,
    });

    const intent = buildMasterLeaseRemeasurementPostingIntent({
      leaseId: 'lease-2',
      effectivePeriod: 4,
      result,
      accounts,
    });

    expect(totals(intent.lines).debit).toBe(totals(intent.lines).credit);
    expect(intent.lines).toContainEqual({
      accountCode: '4400',
      debitMinor: 0,
      creditMinor: 5_000,
    });
  });

  it('rejects incomplete account mappings', () => {
    expect(() => buildMasterLeaseRemeasurementPostingIntent({
      leaseId: 'lease-3',
      effectivePeriod: 1,
      result: remeasureMasterLease({
        leaseId: 'lease-3',
        effectivePeriod: 1,
        carryingLiabilityMinor: 80_000,
        carryingRouAssetMinor: 80_000,
        revisedPayments: [{ period: 1, amountMinor: 80_000 }],
        annualDiscountRateBps: 0,
        periodsPerYear: 12,
      }),
      accounts: { ...accounts, terminationLoss: '' },
    })).toThrow('accounts.terminationLoss');
  });
});
