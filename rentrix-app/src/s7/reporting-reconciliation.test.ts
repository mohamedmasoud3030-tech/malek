import { describe, expect, it } from 'vitest';
import {
  buildPortfolioLeaseReport,
  reconcileMasterLeaseBalances,
} from './reporting-reconciliation';

describe('S07 reporting and reconciliation kernel', () => {
  it('marks a complete liability and ROU roll-forward as balanced', () => {
    const result = reconcileMasterLeaseBalances({
      openingLiabilityMinor: 100_000,
      additionsMinor: 0,
      interestMinor: 5_000,
      cashPaidMinor: 25_000,
      remeasurementMinor: 10_000,
      terminationReductionMinor: 0,
      closingLiabilityMinor: 90_000,
      openingRouAssetMinor: 110_000,
      rouAdditionsMinor: 0,
      rouRemeasurementMinor: 10_000,
      rouTerminationReductionMinor: 0,
      depreciationMinor: 20_000,
      closingRouAssetMinor: 100_000,
      currentLiabilityMinor: 30_000,
      nonCurrentLiabilityMinor: 60_000,
    });

    expect(result.status).toBe('balanced');
    expect(result.issues).toEqual([]);
    expect(result.liabilityDifferenceMinor).toBe(0);
    expect(result.rouDifferenceMinor).toBe(0);
    expect(result.splitDifferenceMinor).toBe(0);
  });

  it('reports independent liability, ROU and split mismatches', () => {
    const result = reconcileMasterLeaseBalances({
      openingLiabilityMinor: 100_000,
      additionsMinor: 0,
      interestMinor: 5_000,
      cashPaidMinor: 25_000,
      remeasurementMinor: 0,
      terminationReductionMinor: 0,
      closingLiabilityMinor: 81_000,
      openingRouAssetMinor: 100_000,
      rouAdditionsMinor: 0,
      rouRemeasurementMinor: 0,
      rouTerminationReductionMinor: 0,
      depreciationMinor: 10_000,
      closingRouAssetMinor: 89_000,
      currentLiabilityMinor: 30_000,
      nonCurrentLiabilityMinor: 50_000,
    });

    expect(result.status).toBe('warning');
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'LIABILITY_ROLLFORWARD_MISMATCH',
      'ROU_ROLLFORWARD_MISMATCH',
      'CURRENT_SPLIT_MISMATCH',
    ]);
  });

  it('treats negative closing balances as an error', () => {
    const result = reconcileMasterLeaseBalances({
      openingLiabilityMinor: 0,
      additionsMinor: 0,
      interestMinor: 0,
      cashPaidMinor: 0,
      remeasurementMinor: 0,
      terminationReductionMinor: 0,
      closingLiabilityMinor: -1,
      openingRouAssetMinor: 0,
      rouAdditionsMinor: 0,
      rouRemeasurementMinor: 0,
      rouTerminationReductionMinor: 0,
      depreciationMinor: 0,
      closingRouAssetMinor: 0,
      currentLiabilityMinor: 0,
      nonCurrentLiabilityMinor: -1,
    });

    expect(result.status).toBe('error');
    expect(result.issues.some((issue) => issue.code === 'NEGATIVE_BALANCE')).toBe(true);
  });

  it('aggregates disclosures into a portfolio report without inventing data', () => {
    const report = buildPortfolioLeaseReport([
      {
        openingLiabilityMinor: 100_000,
        interestExpenseMinor: 5_000,
        cashPaymentsMinor: 25_000,
        principalReductionMinor: 20_000,
        closingLiabilityMinor: 80_000,
        rouDepreciationMinor: 10_000,
        closingRouAssetMinor: 90_000,
        currentLiabilityMinor: 30_000,
        nonCurrentLiabilityMinor: 50_000,
      },
      {
        openingLiabilityMinor: 50_000,
        interestExpenseMinor: 2_000,
        cashPaymentsMinor: 12_000,
        principalReductionMinor: 10_000,
        closingLiabilityMinor: 40_000,
        rouDepreciationMinor: 5_000,
        closingRouAssetMinor: 45_000,
        currentLiabilityMinor: 15_000,
        nonCurrentLiabilityMinor: 25_000,
      },
    ]);

    expect(report).toEqual({
      leaseCount: 2,
      totalOpeningLiabilityMinor: 150_000,
      totalClosingLiabilityMinor: 120_000,
      totalCurrentLiabilityMinor: 45_000,
      totalNonCurrentLiabilityMinor: 75_000,
      totalInterestExpenseMinor: 7_000,
      totalCashPaymentsMinor: 37_000,
      totalPrincipalReductionMinor: 30_000,
      totalRouDepreciationMinor: 15_000,
      totalClosingRouAssetMinor: 135_000,
    });
  });

  it('rejects non-integer minor-unit inputs', () => {
    expect(() =>
      reconcileMasterLeaseBalances({
        openingLiabilityMinor: 1.25,
        additionsMinor: 0,
        interestMinor: 0,
        cashPaidMinor: 0,
        remeasurementMinor: 0,
        terminationReductionMinor: 0,
        closingLiabilityMinor: 0,
        openingRouAssetMinor: 0,
        rouAdditionsMinor: 0,
        rouRemeasurementMinor: 0,
        rouTerminationReductionMinor: 0,
        depreciationMinor: 0,
        closingRouAssetMinor: 0,
        currentLiabilityMinor: 0,
        nonCurrentLiabilityMinor: 0,
      }),
    ).toThrow('openingLiabilityMinor must be a safe integer in minor units');
  });
});
