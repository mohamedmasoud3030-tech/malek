/**
 * Accounting Reports Facade — Stable adapter for WP-A migration.
 *
 * This is the SINGLE import path for all accounting report consumers.
 * It encapsulates the feature-flag logic and provides a stable API surface
 * that does not change during the migration from financials/reports to
 * accounting/reports.
 *
 * Consumers MUST import from here, NOT from:
 *   - @/features/financials/reports/financialReportsService
 *   - @/features/financials/reports/accounting-reports-service
 *   - @/features/financials/reports/statements-reports-service
 *
 * When NEXT_ACCOUNTING=true:
 *   - Uses new accounting/reports/ services (GL-backed, OMR 3dp canonical)
 * When NEXT_ACCOUNTING=false:
 *   - Falls back to legacy financials/reports services
 *
 * Rollback = toggle NEXT_ACCOUNTING=false. No code changes needed.
 */

import { isFeatureEnabled } from '@/lib/feature-flags';

// Type re-exports from the canonical contracts
export type {
  TrialBalanceReport,
  IncomeStatementReport,
  BalanceSheetReport,
  CashFlowReport,
  ReconciliationRow,
  StatementReport,
  AccountingReportFilters,
} from '@/features/accounting/reports/contracts';

// Feature flag key
const NEXT_ACCOUNTING = 'next-accounting';

// ---------------------------------------------------------------------------
// Facade functions — stable API surface
// ---------------------------------------------------------------------------

/** Get Trial Balance Report — uses NEW accounting domain when flag is ON. */
export async function getTrialBalanceReport(asOf: string) {
  if (isFeatureEnabled(NEXT_ACCOUNTING)) {
    const { getTrialBalanceReport: fn } = await import(
      '@/features/accounting/reports/statements/accountingReportsService'
    );
    return fn(asOf);
  }
  const { getTrialBalanceReport: fn } = await import(
    '@/features/financials/reports/accounting-reports-service'
  );
  return fn(asOf);
}

/** Get Income Statement (P&L) Report — uses NEW accounting domain when flag is ON. */
export async function getIncomeStatementReport(
  filters: { dateFrom: string; dateTo: string }
) {
  if (isFeatureEnabled(NEXT_ACCOUNTING)) {
    const { getIncomeStatementReport: fn } = await import(
      '@/features/accounting/reports/statements/accountingReportsService'
    );
    return fn(filters);
  }
  const { getIncomeStatementReport: fn } = await import(
    '@/features/financials/reports/accounting-reports-service'
  );
  return fn(filters);
}

/** Get Balance Sheet Report — uses NEW accounting domain when flag is ON. */
export async function getBalanceSheetReport(asOf: string) {
  if (isFeatureEnabled(NEXT_ACCOUNTING)) {
    const { getBalanceSheetReport: fn } = await import(
      '@/features/accounting/reports/statements/accountingReportsService'
    );
    return fn(asOf);
  }
  const { getBalanceSheetReport: fn } = await import(
    '@/features/financials/reports/accounting-reports-service'
  );
  return fn(asOf);
}

/** Get Cash Flow Report — uses NEW accounting domain when flag is ON. */
export async function getCashFlowReport(from: string, to: string) {
  if (isFeatureEnabled(NEXT_ACCOUNTING)) {
    const { getCashFlowReport: fn } = await import(
      '@/features/accounting/reports/statements/accountingReportsService'
    );
    return fn(from, to);
  }
  // Legacy: use wp05Services cash flow (S08/S09 canonical)
  const { getCashFlowReport: fn } = await import(
    '@/features/accounting/wp05Services'
  );
  return fn(from, to);
}

/** Get Reconciliation Report — uses NEW accounting domain when flag is ON. */
export async function getReconciliationReport(asOf?: string) {
  if (isFeatureEnabled(NEXT_ACCOUNTING)) {
    const { getReconciliationReport: fn } = await import(
      '@/features/accounting/reports/reconciliation/reconciliationService'
    );
    return fn(asOf);
  }
  // Legacy: use wp05Services reconciliation (S08/S09 gate preserved)
  const { getReconciliation: fn } = await import(
    '@/features/accounting/wp05Services'
  );
  return fn(asOf);
}

/** Get Statement Report — uses NEW accounting domain when flag is ON. */
export async function getStatementReport(
  company_id: string,
  asOf?: string
) {
  if (isFeatureEnabled(NEXT_ACCOUNTING)) {
    const { getStatementReport: fn } = await import(
      '@/features/accounting/reports/statements/statementsService'
    );
    return fn(company_id, asOf);
  }
  // Legacy: financial reports had no statement report; new in accounting domain
  throw new Error(
    'Statement reports require NEXT_ACCOUNTING feature flag — ' +
      'this is a new accounting-domain feature, not available in legacy financials.'
  );
}

/** Assert reconciliation passes — uses NEW accounting domain when flag is ON. */
export async function assertReconciliation(asOf?: string) {
  if (isFeatureEnabled(NEXT_ACCOUNTING)) {
    const { assertReconciliation: fn } = await import(
      '@/features/accounting/reports/reconciliation/reconciliationService'
    );
    return fn(asOf);
  }
  // Legacy: use wp05Services assertion (S08/S09 gate preserved)
  const { assertReconciliation: fn } = await import(
    '@/features/accounting/wp05Services'
  );
  return fn(asOf);
}