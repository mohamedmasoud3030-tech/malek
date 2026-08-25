/**
 * Accounting Reports Service — Stage 3 GL-backed report logic.
 *
 * Migration of financialReportsService.ts functions into the Accounting domain.
 * All monetary values are OMR 3dp, derived from the canonical shared monetary API.
 *
 * Report functions (all OMR 3dp precision):
 *   1. getTrialBalanceReport(asOf) → TrialBalanceReport
 *   2. getIncomeStatementReport(filters) → IncomeStatementReport
 *   3. getBalanceSheetReport(asOf) → BalanceSheetReport
 *   4. getCashFlowReport(from, to) → CashFlowReport
 *   5. getReconciliationReport(asOf) → ReconciliationRow[]
 *   6. getStatementReport(company_id, asOf) → StatementReport
 */

import { supabase } from '@/lib/supabase';
import {
  roundMoney,
  MONEY_STEP,
  MONEY_MINOR_UNIT,
  validateMoney,
  type MoneyValidationResult,
  normalizeOm3,
} from '@/shared/monetary/monetaryContract';
import type {
  TrialBalanceReport,
  IncomeStatementReport,
  BalanceSheetReport,
  CashFlowReport,
  ReconciliationRow,
  StatementReport,
  StatementLine,
  AccountingReportFilters,
  TrialBalanceRpcRow,
  IncomeStatementRpcResponse,
  BalanceSheetRpcResponse,
  CashFlowRpcResponse,
  ReconciliationRpcRow,
  StatementRpcResponse,
} from '@/features/accounting/reports/contracts';

// ---------------------------------------------------------------------------
// Helper: normalize a raw RPC number to OMR 3dp using canonical rounding
// ---------------------------------------------------------------------------
// function normalizeOm3(value: unknown): number {  // REMOVED: now exported from monetaryContract.ts
//   const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
//   return roundMoney(n); // EPSILON-adjusted half-up, matches server public._r3
// }

// ---------------------------------------------------------------------------
// 1. Trial Balance Report
// ---------------------------------------------------------------------------

export async function getTrialBalanceReport(asOf: string): Promise<TrialBalanceReport> {
  const { data, error } = await supabase.rpc('rpt_trial_balance', { p_as_of: asOf });
  if (error) throw error;

  const rawAccounts = Array.isArray(data) ? data : (data?.accounts ?? []);
  const accounts = rawAccounts.map((row: unknown) => {
    const r = row as TrialBalanceRpcRow;
    return {
      code: String(r.code ?? '').trim() || '',
      name: String(r.name ?? '').trim() || '',
      type: String(r.type ?? '').trim() || '',
      balanceType: (String(r.balance_type ?? 'debit').trim() === 'credit' ? 'credit' : 'debit'),
      balance: normalizeOm3(r.balance),
    };
  });

  const totalDebits = accounts
    .filter((a) => a.balanceType === 'debit')
    .reduce((sum: number, a) => sum + a.balance, 0);
  const totalCredits = accounts
    .filter((a) => a.balanceType === 'credit')
    .reduce((sum: number, a) => sum + a.balance, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

  return { asOf, accounts, totalDebits, totalCredits, isBalanced };
}

// ---------------------------------------------------------------------------
// 2. Income Statement (P&L) Report
// ---------------------------------------------------------------------------

export async function getIncomeStatementReport(
  filters: { dateFrom: string; dateTo: string }
): Promise<IncomeStatementReport> {
  const { data, error } = await supabase.rpc('rpt_income_statement', {
    p_from: filters.dateFrom,
    p_to: filters.dateTo,
  });
  if (error) throw error;

  const response = data as IncomeStatementRpcResponse;
  const revenueLines = Array.isArray(response?.revenue) ? response.revenue : [];
  const expenseLines = Array.isArray(response?.expenses) ? response.expenses : [];

  const revenue = revenueLines.map((row) => ({
    label: String(row.label ?? '').trim() || '',
    amount: normalizeOm3(row.amount),
  }));

  const expenses = expenseLines.map((row) => ({
    label: String(row.label ?? '').trim() || '',
    amount: normalizeOm3(row.amount),
  }));

  const totalRevenue = revenue.reduce((sum: number, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum: number, e) => sum + e.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  return {
    period: { from: String(response?.period?.from ?? filters.dateFrom).trim(), to: String(response?.period?.to ?? filters.dateTo).trim() },
    revenue,
    totalRevenue,
    expenses,
    totalExpenses,
    netIncome,
  };
}

// ---------------------------------------------------------------------------
// 3. Balance Sheet Report
// ---------------------------------------------------------------------------

export async function getBalanceSheetReport(asOf: string): Promise<BalanceSheetReport> {
  const { data, error } = await supabase.rpc('rpt_balance_sheet', { p_as_of: asOf });
  if (error) throw error;

  const response = data as BalanceSheetRpcResponse;
  const rawAssets = Array.isArray(response?.assets) ? response.assets : [];
  const rawLiabilities = Array.isArray(response?.liabilities) ? response.liabilities : [];
  const rawEquity = Array.isArray(response?.equity) ? response.equity : [];

  const assets = rawAssets.map((row: unknown) => {
    const r = row as { code: string | null; name: string | null; amount: number | string | null };
    return {
      code: String(r.code ?? '').trim() || '',
      name: String(r.name ?? '').trim() || '',
      amount: normalizeOm3(r.amount),
    };
  });

  const liabilities = rawLiabilities.map((row: unknown) => {
    const r = row as { code: string | null; name: string | null; amount: number | string | null };
    return {
      code: String(r.code ?? '').trim() || '',
      name: String(r.name ?? '').trim() || '',
      amount: normalizeOm3(r.amount),
    };
  });

  const equity = rawEquity.map((row: unknown) => {
    const r = row as { code: string | null; name: string | null; amount: number | string | null };
    return {
      code: String(r.code ?? '').trim() || '',
      name: String(r.name ?? '').trim() || '',
      amount: normalizeOm3(r.amount),
    };
  });

  const totalAssets = assets.reduce((sum: number, a) => sum + a.amount, 0);
  const totalLiabilities = liabilities.reduce((sum: number, l) => sum + l.amount, 0);
  const totalEquity = equity.reduce((sum: number, e) => sum + e.amount, 0);
  const isBalanced = Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.001;

  return {
    asOf,
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    totalEquity,
    isBalanced,
  };
}

// ---------------------------------------------------------------------------
// 4. Cash Flow Report
// ---------------------------------------------------------------------------

export async function getCashFlowReport(from: string, to: string): Promise<CashFlowReport> {
  const { data, error } = await supabase.rpc('wp05_rpt_cash_flow_gl', { p_from: from, p_to: to });
  if (error) throw error;

  const response = data as CashFlowRpcResponse;
  return {
    period: {
      from: String(response?.period?.from ?? from).trim(),
      to: String(response?.period?.to ?? to).trim(),
    },
    openingCash: normalizeOm3(response?.opening_cash),
    operating: normalizeOm3(response?.operating),
    investing: normalizeOm3(response?.investing),
    financing: normalizeOm3(response?.financing),
    unclassified: normalizeOm3(response?.unclassified),
    totalChange: normalizeOm3(response?.total_change),
    closingCash: normalizeOm3(response?.closing_cash),
    variance: normalizeOm3(response?.variance),
    isBalanced: Boolean(response?.is_balanced),
    currency: String(response?.currency ?? 'OMR').trim() || 'OMR',
  };
}

// ---------------------------------------------------------------------------
// 5. Reconciliation Report
// ---------------------------------------------------------------------------

export async function getReconciliationReport(asOf?: string): Promise<ReconciliationRow[]> {
  const p_as_of = asOf ?? new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.rpc('wp05_reconcile_all', { p_as_of });
  if (error) throw error;

  // data may be array directly (since function returns table)
  const rows = Array.isArray(data) ? data : (data?.rows ?? []);

  return rows.map((row: unknown) => {
    const r = row as ReconciliationRpcRow;
    return {
      reconciliation_class: String(r.reconciliation_class ?? '').trim() || '',
      account_no: String(r.account_no ?? '').trim() || '',
      account_name: String(r.account_name ?? '').trim() || '',
      subledger_balance: normalizeOm3(r.subledger_balance),
      gl_balance: normalizeOm3(r.gl_balance),
      variance: normalizeOm3(r.variance),
      abs_variance: normalizeOm3(r.abs_variance),
      currency: String(r.currency ?? 'OMR').trim() || 'OMR',
      reconciliation_status:
        String(r.reconciliation_status ?? '').trim() === 'PASS' ? 'PASS' : 'FAIL',
      subledger_count: Number(r.subledger_count) || 0,
      gl_count: Number(r.gl_count) || 0,
    };
  });
}

// ---------------------------------------------------------------------------
// 6. Statement Report (Tenant/Owner periodic statement)
// ---------------------------------------------------------------------------

export async function getStatementReport(
  company_id: string,
  asOf?: string
): Promise<StatementReport> {
  const p_as_of = asOf ?? new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.rpc('rpt_statements', {
    p_company_id: company_id,
    p_as_of: p_as_of,
  });
  if (error) throw error;

  const response = data as StatementRpcResponse;
  const rawItems = Array.isArray(response?.line_items) ? response.line_items : [];

  const line_items = rawItems.map((row: unknown) => {
    const r = row as { account_no: string | null; account_name: string | null; debit: number | string | null; credit: number | string | null; description: string | null; effective_date: string | null };
    return {
      account_no: String(r.account_no ?? '').trim() || '',
      account_name: String(r.account_name ?? '').trim() || '',
      debit: normalizeOm3(r.debit),
      credit: normalizeOm3(r.credit),
      description: String(r.description ?? '').trim() || null,
      effective_date: String(r.effective_date ?? '').trim() || null,
    };
  });

  const totalDebits = line_items.reduce((sum: number, item) => sum + item.debit, 0);
  const totalCredits = line_items.reduce((sum: number, item) => sum + item.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

  return {
    asOf: p_as_of,
    company_id,
    period: { from: '', to: '' }, // will be filled by caller if needed
    line_items,
    total_debits: totalDebits,
    total_credits: totalCredits,
    is_balanced: isBalanced,
  };
}