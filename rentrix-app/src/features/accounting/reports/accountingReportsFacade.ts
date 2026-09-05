/**
 * Accounting Reports Facade — Canonical import boundary.
 *
 * This is the SINGLE import path for all accounting report consumers.
 * It encapsulates the canonical accounting report services.
 */

export type {
  TrialBalanceReport,
  TrialBalanceAccount,
  IncomeStatementReport,
  IncomeStatementLine,
  BalanceSheetReport,
  BalanceSheetSectionItem,
  CashFlowReport,
  ReconciliationRow,
  AccountingReportFilters,
} from '@/features/accounting/reports/contracts';

import {
  getTrialBalanceReport,
  getIncomeStatementReport,
  getBalanceSheetReport,
  getCashFlowReport,
} from '@/features/accounting/reports/statements/accountingReportsService';

import {
  getReconciliationReport,
  assertReconciliation,
} from '@/features/accounting/reports/reconciliation/reconciliationService';

export {
  getTrialBalanceReport,
  getIncomeStatementReport,
  getBalanceSheetReport,
  getCashFlowReport,
  getReconciliationReport,
  assertReconciliation,
};
