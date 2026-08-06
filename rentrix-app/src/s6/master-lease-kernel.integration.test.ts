import { describe, expect, it } from 'vitest';
import {
  buildMasterLeasePostingIntents,
  buildMasterLeaseRemeasurementPostingIntent,
  buildMasterLeaseSchedule,
  classifyMasterLease,
  remeasureMasterLease,
} from './index';

const accounts = {
  rouAsset: '1600',
  leaseLiability: '2500',
  cashOrBank: '1120',
  depreciationExpense: '6200',
  accumulatedRouDepreciation: '1650',
  leaseInterestExpense: '6300',
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

describe('master lease accounting kernel integration', () => {
  it('classifies, measures, schedules and produces balanced intents', () => {
    const classification = classifyMasterLease({
      leaseTermMonths: 24,
      purchaseOptionReasonablyCertain: false,
      lowValueExemptionElected: false,
      shortTermExemptionElected: false,
    });
    expect(classification.recognitionRequired).toBe(true);

    const schedule = buildMasterLeaseSchedule({
      payments: Array.from({ length: 24 }, (_, index) => ({
        period: index + 1,
        amountMinor: 25_000,
      })),
      annualDiscountRateBps: 500,
      periodsPerYear: 12,
      initialDirectCostsMinor: 3_000,
    });

    const intents = buildMasterLeasePostingIntents({
      leaseId: 'lease-int-1',
      schedule,
      accounts,
    });

    expect(schedule.rows.at(-1)?.closingLiabilityMinor).toBe(0);
    expect(schedule.rows.at(-1)?.closingRouAssetMinor).toBe(0);
    for (const intent of intents) {
      const sum = totals(intent.lines);
      expect(sum.debit).toBe(sum.credit);
    }
  });

  it('remeasures and produces a balanced adjustment intent', () => {
    const result = remeasureMasterLease({
      leaseId: 'lease-int-2',
      effectivePeriod: 13,
      carryingLiabilityMinor: 250_000,
      carryingRouAssetMinor: 230_000,
      revisedPayments: Array.from({ length: 12 }, (_, index) => ({
        period: index + 1,
        amountMinor: 22_000,
      })),
      annualDiscountRateBps: 450,
      periodsPerYear: 12,
      scopeReductionBps: 2_500,
    });

    const intent = buildMasterLeaseRemeasurementPostingIntent({
      leaseId: 'lease-int-2',
      effectivePeriod: 13,
      result,
      accounts: {
        rouAsset: '1600',
        leaseLiability: '2500',
        terminationGain: '4400',
        terminationLoss: '6400',
      },
    });

    const sum = totals(intent.lines);
    expect(sum.debit).toBe(sum.credit);
    expect(intent.eventId).toBe(result.eventId);
  });
});
