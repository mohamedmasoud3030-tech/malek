/**
 * Accounting Reports Service — Stage 3 GL-backed report logic.
 *
 * Migration of financialReportsService.ts functions into the Accounting domain.
 * All monetary values are OMR 3dp, derived from the canonical shared monetary API.
 */

import { supabase } from '@/lib/supabase';
import { normalizeOm3 } from '@/shared/monetary/monetaryContract';
import type {
  TrialBalanceReport,
  IncomeStatementReport,
  BalanceSheetReport,
  CashFlowReport,
  ReconciliationRow,
  TrialBalanceRpcRow,
  IncomeStatementRpcResponse,
  BalanceSheetRpcResponse,
  CashFlowRpcResponse,
  ReconciliationRpcRow,
} from '@/features/accounting/reports/contracts';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function todayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// 1. Trial Balance Report
// ---------------------------------------------------------------------------

export async function getTrialBalanceReport(asOf: string): Promise<TrialBalanceReport> {
  const { data, error } = await supabase.rpc('rpt_trial_balance', { p_as_of: asOf });
  if (error) throw error;

  const rawAccounts: unknown[] = Array.isArray(data)
    ? data
    : asArray(asRecord(data).accounts);

  const accounts: TrialBalanceReport['accounts'] = rawAccounts.map((row: unknown) => {
    const r = row as TrialBalanceRpcRow;
    return {
      code: String(r.code ?? '').trim(),
      name: String(r.name ?? '').trim(),
      type: String(r.type ?? '').trim(),
      balanceType:
        String(r.balance_type ?? 'debit').trim() === 'credit' ? 'credit' : 'debit',
      balance: normalizeOm3(r.balance),
    };
  });

  const totalDebits = accounts
    .filter((account) => account.balanceType === 'debit')
    .reduce((sum, account) => sum + account.balance, 0);
  const totalCredits = accounts
    .filter((account) => account.balanceType === 'credit')
    .reduce((sum, account) => sum + account.balance, 0);
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
    label: String(row.label ?? '').trim(),
    amount: normalizeOm3(row.amount),
  }));

  const expenses = expenseLines.map((row) => ({
    label: String(row.label ?? '').trim(),
    amount: normalizeOm3(row.amount),
  }));

  const totalRevenue = revenue.reduce((sum, row) => sum + row.amount, 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + row.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  return {
    period: {
      from: String(response?.period?.from ?? filters.dateFrom).trim(),
      to: String(response?.period?.to ?? filters.dateTo).trim(),
    },
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
      code: String(r.code ?? '').trim(),
      name: String(r.name ?? '').trim(),
      amount: normalizeOm3(r.amount),
    };
  });

  const liabilities = rawLiabilities.map((row: unknown) => {
    const r = row as { code: string | null; name: string | null; amount: number | string | null };
    return {
      code: String(r.code ?? '').trim(),
      name: String(r.name ?? '').trim(),
      amount: normalizeOm3(r.amount),
    };
  });

  const equity = rawEquity.map((row: unknown) => {
    const r = row as { code: string | null; name: string | null; amount: number | string | null };
    return {
      code: String(r.code ?? '').trim(),
      name: String(r.name ?? '').trim(),
      amount: normalizeOm3(r.amount),
    };
  });

  const totalAssets = assets.reduce((sum, row) => sum + row.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, row) => sum + row.amount, 0);
  const totalEquity = equity.reduce((sum, row) => sum + row.amount, 0);
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
  const { data, error } = await supabase.rpc('wp05_rpt_cash_flow_gl', {
    p_from: from,
    p_to: to,
  });
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
  const p_as_of = asOf ?? todayIsoDate();
  const { data, error } = await supabase.rpc('wp05_reconcile_all', { p_as_of });
  if (error) throw error;

  const rows: unknown[] = Array.isArray(data)
    ? data
    : asArray(asRecord(data).rows ?? data);

  return rows.map((row: unknown) => {
    const r = row as ReconciliationRpcRow;
    return {
      reconciliation_class: String(r.reconciliation_class ?? '').trim(),
      account_no: String(r.account_no ?? '').trim(),
      account_name: String(r.account_name ?? '').trim(),
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
