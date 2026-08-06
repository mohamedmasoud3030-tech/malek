import type { MasterLeaseDisclosureSummary } from '../s6/master-lease-disclosures';

export type ReconciliationStatus = 'balanced' | 'warning' | 'error';

export type ReconciliationIssue = Readonly<{
  code:
    | 'LIABILITY_ROLLFORWARD_MISMATCH'
    | 'ROU_ROLLFORWARD_MISMATCH'
    | 'NEGATIVE_BALANCE'
    | 'CURRENT_SPLIT_EXCEEDS_TOTAL';
  message: string;
  differenceMinor: number;
}>;

export type MasterLeaseReconciliationInput = Readonly<{
  openingLiabilityMinor: number;
  additionsMinor: number;
  interestMinor: number;
  cashPaidMinor: number;
  remeasurementMinor: number;
  terminationReductionMinor: number;
  closingLiabilityMinor: number;
  openingRouAssetMinor: number;
  rouAdditionsMinor: number;
  rouRemeasurementMinor: number;
  rouTerminationReductionMinor: number;
  depreciationMinor: number;
  closingRouAssetMinor: number;
  currentLiabilityMinor: number;
  nonCurrentLiabilityMinor: number;
}>;

export type MasterLeaseReconciliationResult = Readonly<{
  status: ReconciliationStatus;
  liabilityExpectedMinor: number;
  liabilityActualMinor: number;
  liabilityDifferenceMinor: number;
  rouExpectedMinor: number;
  rouActualMinor: number;
  rouDifferenceMinor: number;
  splitDifferenceMinor: number;
  issues: readonly ReconciliationIssue[];
}>;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer in minor units`);
  }
}

export function reconcileMasterLeaseBalances(
  input: MasterLeaseReconciliationInput,
): MasterLeaseReconciliationResult {
  for (const [key, value] of Object.entries(input)) assertSafeInteger(value, key);

  const liabilityExpectedMinor =
    input.openingLiabilityMinor +
    input.additionsMinor +
    input.interestMinor +
    input.remeasurementMinor -
    input.cashPaidMinor -
    input.terminationReductionMinor;
  const liabilityDifferenceMinor = input.closingLiabilityMinor - liabilityExpectedMinor;

  const rouExpectedMinor =
    input.openingRouAssetMinor +
    input.rouAdditionsMinor +
    input.rouRemeasurementMinor -
    input.rouTerminationReductionMinor -
    input.depreciationMinor;
  const rouDifferenceMinor = input.closingRouAssetMinor - rouExpectedMinor;

  const splitDifferenceMinor =
    input.currentLiabilityMinor + input.nonCurrentLiabilityMinor - input.closingLiabilityMinor;

  const issues: ReconciliationIssue[] = [];
  if (liabilityDifferenceMinor !== 0) {
    issues.push({
      code: 'LIABILITY_ROLLFORWARD_MISMATCH',
      message: 'Closing lease liability does not match the contractual roll-forward.',
      differenceMinor: liabilityDifferenceMinor,
    });
  }
  if (rouDifferenceMinor !== 0) {
    issues.push({
      code: 'ROU_ROLLFORWARD_MISMATCH',
      message: 'Closing ROU asset does not match the asset roll-forward.',
      differenceMinor: rouDifferenceMinor,
    });
  }
  if (input.closingLiabilityMinor < 0 || input.closingRouAssetMinor < 0) {
    issues.push({
      code: 'NEGATIVE_BALANCE',
      message: 'A closing master-lease balance is negative.',
      differenceMinor: Math.min(input.closingLiabilityMinor, input.closingRouAssetMinor),
    });
  }
  if (splitDifferenceMinor !== 0) {
    issues.push({
      code: 'CURRENT_SPLIT_EXCEEDS_TOTAL',
      message: 'Current and non-current lease liabilities do not equal the total liability.',
      differenceMinor: splitDifferenceMinor,
    });
  }

  const status: ReconciliationStatus = issues.some((issue) => issue.code === 'NEGATIVE_BALANCE')
    ? 'error'
    : issues.length > 0
      ? 'warning'
      : 'balanced';

  return {
    status,
    liabilityExpectedMinor,
    liabilityActualMinor: input.closingLiabilityMinor,
    liabilityDifferenceMinor,
    rouExpectedMinor,
    rouActualMinor: input.closingRouAssetMinor,
    rouDifferenceMinor,
    splitDifferenceMinor,
    issues,
  };
}

export type PortfolioLeaseReport = Readonly<{
  leaseCount: number;
  totalInitialLiabilityMinor: number;
  totalClosingLiabilityMinor: number;
  totalCurrentLiabilityMinor: number;
  totalNonCurrentLiabilityMinor: number;
  totalInterestMinor: number;
  totalCashPaidMinor: number;
  totalPrincipalMinor: number;
  totalRouDepreciationMinor: number;
}>;

export function buildPortfolioLeaseReport(
  disclosures: readonly MasterLeaseDisclosureSummary[],
): PortfolioLeaseReport {
  return disclosures.reduce<PortfolioLeaseReport>(
    (total, disclosure) => ({
      leaseCount: total.leaseCount + 1,
      totalInitialLiabilityMinor:
        total.totalInitialLiabilityMinor + disclosure.initialLiabilityMinor,
      totalClosingLiabilityMinor:
        total.totalClosingLiabilityMinor + disclosure.closingLiabilityMinor,
      totalCurrentLiabilityMinor:
        total.totalCurrentLiabilityMinor + disclosure.currentLiabilityMinor,
      totalNonCurrentLiabilityMinor:
        total.totalNonCurrentLiabilityMinor + disclosure.nonCurrentLiabilityMinor,
      totalInterestMinor: total.totalInterestMinor + disclosure.totalInterestMinor,
      totalCashPaidMinor: total.totalCashPaidMinor + disclosure.totalCashPaidMinor,
      totalPrincipalMinor: total.totalPrincipalMinor + disclosure.totalPrincipalMinor,
      totalRouDepreciationMinor:
        total.totalRouDepreciationMinor + disclosure.totalRouDepreciationMinor,
    }),
    {
      leaseCount: 0,
      totalInitialLiabilityMinor: 0,
      totalClosingLiabilityMinor: 0,
      totalCurrentLiabilityMinor: 0,
      totalNonCurrentLiabilityMinor: 0,
      totalInterestMinor: 0,
      totalCashPaidMinor: 0,
      totalPrincipalMinor: 0,
      totalRouDepreciationMinor: 0,
    },
  );
}
