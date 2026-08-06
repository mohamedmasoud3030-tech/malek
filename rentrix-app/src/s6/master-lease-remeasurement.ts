import { buildMasterLeaseSchedule, type LeasePayment, type LeaseSchedule } from './master-lease-schedule';

export type LeaseRemeasurementInput = Readonly<{
  leaseId: string;
  effectivePeriod: number;
  carryingLiabilityMinor: number;
  carryingRouAssetMinor: number;
  revisedPayments: readonly LeasePayment[];
  annualDiscountRateBps: number;
  periodsPerYear: number;
  scopeReductionBps?: number;
}>;

export type LeaseRemeasurementResult = Readonly<{
  eventId: string;
  revisedSchedule: LeaseSchedule;
  liabilityDeltaMinor: number;
  rouAdjustmentMinor: number;
  terminationGainLossMinor: number;
}>;

function assertSafeMinor(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer in minor units`);
  }
}

function stableEventId(leaseId: string, effectivePeriod: number, payments: readonly LeasePayment[]): string {
  const paymentKey = payments
    .map((payment) => `${payment.period}:${payment.amountMinor}`)
    .sort()
    .join('|');
  return `master-lease:${leaseId}:remeasure:${effectivePeriod}:${paymentKey}`;
}

export function remeasureMasterLease(input: LeaseRemeasurementInput): LeaseRemeasurementResult {
  if (!input.leaseId.trim()) throw new Error('leaseId is required');
  if (!Number.isInteger(input.effectivePeriod) || input.effectivePeriod <= 0) {
    throw new Error('effectivePeriod must be a positive integer');
  }
  assertSafeMinor(input.carryingLiabilityMinor, 'carryingLiabilityMinor');
  assertSafeMinor(input.carryingRouAssetMinor, 'carryingRouAssetMinor');

  const scopeReductionBps = input.scopeReductionBps ?? 0;
  if (!Number.isInteger(scopeReductionBps) || scopeReductionBps < 0 || scopeReductionBps > 10_000) {
    throw new Error('scopeReductionBps must be an integer between 0 and 10000');
  }

  const revisedSchedule = buildMasterLeaseSchedule({
    payments: input.revisedPayments,
    annualDiscountRateBps: input.annualDiscountRateBps,
    periodsPerYear: input.periodsPerYear,
  });

  const liabilityDeltaMinor = revisedSchedule.initialLiabilityMinor - input.carryingLiabilityMinor;

  if (scopeReductionBps === 0) {
    const rouAdjustmentMinor = liabilityDeltaMinor;
    if (input.carryingRouAssetMinor + rouAdjustmentMinor < 0) {
      throw new Error('remeasurement would reduce the ROU asset below zero');
    }
    return {
      eventId: stableEventId(input.leaseId, input.effectivePeriod, input.revisedPayments),
      revisedSchedule,
      liabilityDeltaMinor,
      rouAdjustmentMinor,
      terminationGainLossMinor: 0,
    };
  }

  const liabilityDerecognitionMinor = Math.round(input.carryingLiabilityMinor * scopeReductionBps / 10_000);
  const rouDerecognitionMinor = Math.round(input.carryingRouAssetMinor * scopeReductionBps / 10_000);
  const terminationGainLossMinor = liabilityDerecognitionMinor - rouDerecognitionMinor;
  const remainingLiabilityMinor = input.carryingLiabilityMinor - liabilityDerecognitionMinor;
  const liabilityDeltaAfterReductionMinor = revisedSchedule.initialLiabilityMinor - remainingLiabilityMinor;
  const rouAdjustmentMinor = -rouDerecognitionMinor + liabilityDeltaAfterReductionMinor;

  if (input.carryingRouAssetMinor + rouAdjustmentMinor < 0) {
    throw new Error('scope reduction would reduce the ROU asset below zero');
  }

  return {
    eventId: stableEventId(input.leaseId, input.effectivePeriod, input.revisedPayments),
    revisedSchedule,
    liabilityDeltaMinor: revisedSchedule.initialLiabilityMinor - input.carryingLiabilityMinor,
    rouAdjustmentMinor,
    terminationGainLossMinor,
  };
}
