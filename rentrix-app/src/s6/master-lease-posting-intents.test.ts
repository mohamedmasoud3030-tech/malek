import { describe, expect, it } from 'vitest';
import { buildMasterLeaseSchedule } from './master-lease-schedule';
import { buildMasterLeasePostingIntents } from './master-lease-posting-intents';

const accounts = {
  rouAsset: '1600',
  leaseLiability: '2500',
  cashOrBank: '1120',
  depreciationExpense: '6200',
  accumulatedRouDepreciation: '1690',
  leaseInterestExpense: '6300',
} as const;

describe('buildMasterLeasePostingIntents', () => {
  it('creates deterministic balanced initial and periodic intents', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: [
        { period: 1, amountMinor: 50_000 },
        { period: 2, amountMinor: 50_000 },
      ],
      annualDiscountRateBps: 600,
      periodsPerYear: 12,
    });

    const intents = buildMasterLeasePostingIntents({ leaseId: 'lease-1', schedule, accounts });
    expect(intents).toHaveLength(3);
    expect(intents[0]!.eventId).toBe('master-lease:lease-1:initial-recognition');
    expect(intents[1]!.eventId).toBe('master-lease:lease-1:period:1');
    expect(intents[2]!.eventId).toBe('master-lease:lease-1:period:2');

    for (const intent of intents) {
      const debit = intent.lines.reduce((sum, line) => sum + line.debitMinor, 0);
      const credit = intent.lines.reduce((sum, line) => sum + line.creditMinor, 0);
      expect(debit).toBe(credit);
      expect(intent.lines.every((line) => line.debitMinor >= 0 && line.creditMinor >= 0)).toBe(true);
    }
  });

  it('keeps direct-cost and incentive differences out of the liability amount', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: [{ period: 1, amountMinor: 100_000 }],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
      initialDirectCostsMinor: 5_000,
      incentivesMinor: 2_000,
    });

    const [initial] = buildMasterLeasePostingIntents({ leaseId: 'lease-2', schedule, accounts });
    expect(initial!.lines.find((line) => line.accountCode === '2500')?.creditMinor).toBe(100_000);
    expect(initial!.lines.find((line) => line.accountCode === '1600')?.debitMinor).toBe(103_000);
    expect(initial!.lines.find((line) => line.accountCode === '1120')?.creditMinor).toBe(3_000);
  });

  it('rejects blank lease ids and account codes', () => {
    const schedule = buildMasterLeaseSchedule({
      payments: [{ period: 1, amountMinor: 1_000 }],
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    });

    expect(() => buildMasterLeasePostingIntents({ leaseId: ' ', schedule, accounts })).toThrow(
      'leaseId must not be empty',
    );

    expect(() =>
      buildMasterLeasePostingIntents({
        leaseId: 'lease-3',
        schedule,
        accounts: { ...accounts, leaseLiability: '' },
      }),
    ).toThrow('accounts.leaseLiability must not be empty');
  });
});
