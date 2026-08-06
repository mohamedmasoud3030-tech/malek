import { describe, expect, it } from 'vitest';
import { remeasureMasterLease } from './master-lease-remeasurement';

const revisedPayments = [
  { period: 1, amountMinor: 40_000 },
  { period: 2, amountMinor: 40_000 },
] as const;

describe('remeasureMasterLease', () => {
  it('adjusts the ROU asset by the liability delta when there is no scope reduction', () => {
    const result = remeasureMasterLease({
      leaseId: 'lease-1',
      effectivePeriod: 7,
      carryingLiabilityMinor: 70_000,
      carryingRouAssetMinor: 65_000,
      revisedPayments,
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    });

    expect(result.revisedSchedule.initialLiabilityMinor).toBe(80_000);
    expect(result.liabilityDeltaMinor).toBe(10_000);
    expect(result.rouAdjustmentMinor).toBe(10_000);
    expect(result.terminationGainLossMinor).toBe(0);
  });

  it('recognizes a proportional gain or loss for a partial termination', () => {
    const result = remeasureMasterLease({
      leaseId: 'lease-2',
      effectivePeriod: 4,
      carryingLiabilityMinor: 100_000,
      carryingRouAssetMinor: 90_000,
      revisedPayments,
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
      scopeReductionBps: 5_000,
    });

    expect(result.terminationGainLossMinor).toBe(5_000);
    expect(result.liabilityDeltaMinor).toBe(-20_000);
    expect(result.rouAdjustmentMinor).toBe(-15_000);
  });

  it('produces a stable event id for the same business event', () => {
    const input = {
      leaseId: 'lease-3',
      effectivePeriod: 2,
      carryingLiabilityMinor: 80_000,
      carryingRouAssetMinor: 80_000,
      revisedPayments,
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    } as const;

    expect(remeasureMasterLease(input).eventId).toBe(remeasureMasterLease(input).eventId);
  });

  it('rejects unsafe remeasurement inputs', () => {
    expect(() => remeasureMasterLease({
      leaseId: '',
      effectivePeriod: 1,
      carryingLiabilityMinor: 1,
      carryingRouAssetMinor: 1,
      revisedPayments,
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
    })).toThrow('leaseId is required');

    expect(() => remeasureMasterLease({
      leaseId: 'lease-4',
      effectivePeriod: 1,
      carryingLiabilityMinor: 1,
      carryingRouAssetMinor: 1,
      revisedPayments,
      annualDiscountRateBps: 0,
      periodsPerYear: 12,
      scopeReductionBps: 10_001,
    })).toThrow('scopeReductionBps');
  });
});
