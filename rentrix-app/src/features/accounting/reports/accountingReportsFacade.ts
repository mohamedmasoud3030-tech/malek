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
  StatementReport,
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

import {
  getStatementReport,
} from '@/features/accounting/reports/statements/statementsService';

export {
  getTrialBalanceReport,
  getIncomeStatementReport,
  getBalanceSheetReport,
  getCashFlowReport,
  getReconciliationReport,
  getStatementReport,
  assertReconciliation,
};

