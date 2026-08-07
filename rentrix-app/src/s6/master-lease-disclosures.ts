import type { LeaseSchedule } from './master-lease-schedule';

export type MasterLeaseDisclosure = Readonly<{
  openingLiabilityMinor: number;
  interestExpenseMinor: number;
  cashPaymentsMinor: number;
  principalReductionMinor: number;
  closingLiabilityMinor: number;
  rouDepreciationMinor: number;
  closingRouAssetMinor: number;
  currentLiabilityMinor: number;
  nonCurrentLiabilityMinor: number;
}>;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function buildMasterLeaseDisclosure(
  schedule: LeaseSchedule,
  currentPeriodCount = 12,
): MasterLeaseDisclosure {
  if (!Number.isInteger(currentPeriodCount) || currentPeriodCount < 0) {
    throw new Error('currentPeriodCount must be a non-negative integer');
  }
  if (schedule.rows.length === 0) {
    throw new Error('schedule must contain at least one row');
  }

  const openingLiabilityMinor = schedule.initialLiabilityMinor;
  const interestExpenseMinor = sum(schedule.rows.map((row) => row.interestMinor));
  const cashPaymentsMinor = sum(schedule.rows.map((row) => row.paymentMinor));
  const principalReductionMinor = sum(schedule.rows.map((row) => row.principalMinor));
  const rouDepreciationMinor = sum(schedule.rows.map((row) => row.rouDepreciationMinor));
  const closingLiabilityMinor = schedule.rows.at(-1)!.closingLiabilityMinor;
  const closingRouAssetMinor = schedule.rows.at(-1)!.closingRouAssetMinor;

  const currentRows = schedule.rows.slice(0, currentPeriodCount);
  const currentLiabilityMinor = sum(currentRows.map((row) => Math.max(0, row.principalMinor)));
  const nonCurrentLiabilityMinor = Math.max(0, openingLiabilityMinor - currentLiabilityMinor);

  return {
    openingLiabilityMinor,
    interestExpenseMinor,
    cashPaymentsMinor,
    principalReductionMinor,
    closingLiabilityMinor,
    rouDepreciationMinor,
    closingRouAssetMinor,
    currentLiabilityMinor,
    nonCurrentLiabilityMinor,
  };
}
