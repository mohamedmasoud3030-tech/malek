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

function rebaseRouDepreciation(schedule: LeaseSchedule, carryingRouAssetMinor: number): LeaseSchedule {
  assertSafeMinor(carryingRouAssetMinor, 'remeasured carrying ROU asset');
  if (schedule.rows.length === 0) {
    return { ...schedule, initialRouAssetMinor: carryingRouAssetMinor };
  }

  const straightLine = carryingRouAssetMinor / schedule.rows.length;
  let remainingRou = carryingRouAssetMinor;
  const rows = schedule.rows.map((row, index) => {
    const isFinal = index === schedule.rows.length - 1;
    const rouDepreciationMinor = isFinal ? remainingRou : Math.round(straightLine);
    const closingRouAssetMinor = Math.max(0, remainingRou - rouDepreciationMinor);
    remainingRou = closingRouAssetMinor;
    return { ...row, rouDepreciationMinor, closingRouAssetMinor };
  });

  return { ...schedule, initialRouAssetMinor: carryingRouAssetMinor, rows };
}

function zeroTerminationSchedule(periodsPerYear: number, annualDiscountRateBps: number): LeaseSchedule {
  if (!Number.isInteger(periodsPerYear) || periodsPerYear <= 0) {
    throw new Error('periodsPerYear must be a positive integer');
  }
  if (!Number.isFinite(annualDiscountRateBps) || annualDiscountRateBps < 0) {
    throw new Error('annualDiscountRateBps must be a non-negative finite number');
  }
  return {
    initialLiabilityMinor: 0,
    initialRouAssetMinor: 0,
    periodicRate: annualDiscountRateBps / 10_000 / periodsPerYear,
    rows: [],
  };
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
  if (scopeReductionBps === 10_000 && input.revisedPayments.length > 0) {
    throw new Error('full termination must not contain revised payments');
  }

  const baseSchedule = scopeReductionBps === 10_000
    ? zeroTerminationSchedule(input.periodsPerYear, input.annualDiscountRateBps)
    : buildMasterLeaseSchedule({
        payments: input.revisedPayments,
        annualDiscountRateBps: input.annualDiscountRateBps,
        periodsPerYear: input.periodsPerYear,
      });

  const liabilityDeltaMinor = baseSchedule.initialLiabilityMinor - input.carryingLiabilityMinor;

  if (scopeReductionBps === 0) {
    const rouAdjustmentMinor = liabilityDeltaMinor;
    const remeasuredRouMinor = input.carryingRouAssetMinor + rouAdjustmentMinor;
    if (remeasuredRouMinor < 0) {
      throw new Error('remeasurement would reduce the ROU asset below zero');
    }
    return {
      eventId: stableEventId(input.leaseId, input.effectivePeriod, input.revisedPayments),
      revisedSchedule: rebaseRouDepreciation(baseSchedule, remeasuredRouMinor),
      liabilityDeltaMinor,
      rouAdjustmentMinor,
      terminationGainLossMinor: 0,
    };
  }

  const liabilityDerecognitionMinor = Math.round(input.carryingLiabilityMinor * scopeReductionBps / 10_000);
  const rouDerecognitionMinor = Math.round(input.carryingRouAssetMinor * scopeReductionBps / 10_000);
  const terminationGainLossMinor = liabilityDerecognitionMinor - rouDerecognitionMinor;
  const remainingLiabilityMinor = input.carryingLiabilityMinor - liabilityDerecognitionMinor;
  const liabilityDeltaAfterReductionMinor = baseSchedule.initialLiabilityMinor - remainingLiabilityMinor;
  const rouAdjustmentMinor = -rouDerecognitionMinor + liabilityDeltaAfterReductionMinor;
  const remeasuredRouMinor = input.carryingRouAssetMinor + rouAdjustmentMinor;

  if (remeasuredRouMinor < 0) {
    throw new Error('scope reduction would reduce the ROU asset below zero');
  }

  return {
    eventId: stableEventId(input.leaseId, input.effectivePeriod, input.revisedPayments),
    revisedSchedule: rebaseRouDepreciation(baseSchedule, remeasuredRouMinor),
    liabilityDeltaMinor,
    rouAdjustmentMinor,
    terminationGainLossMinor,
  };
}
