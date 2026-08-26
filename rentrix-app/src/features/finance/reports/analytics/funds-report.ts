/**
 * Finance Operational Reports — Funds Report
 *
 * Operational funds reports (deposits, owner settlements, banking).
 * NOT accounting statements — those live in accounting/reports/.
 */

import type {
  DepositSummaryReport,
  OwnerSettlementReport,
  BankReconciliationSummaryReport,
} from './report-types';

export type { DepositSummaryReport, OwnerSettlementReport, BankReconciliationSummaryReport };

// Placeholder implementations — wire up to actual services
export async function getDepositSummaryReport(): Promise<DepositSummaryReport> {
  return { totalHeld: 0, totalDeductions: 0, totalRefunded: 0, depositCount: 0 };
}

export async function getOwnerSettlementReport(): Promise<OwnerSettlementReport> {
  return { totalDue: 0, settled: 0, pending: 0, settlementCount: 0 };
}

export async function getBankReconciliationSummaryReport(): Promise<BankReconciliationSummaryReport> {
  return { totalLines: 0, matchedCount: 0, unmatchedCount: 0, unmatchedAmount: 0 };
}