/**
 * Accounting Reports — Stage 3 Typed Contracts.
 *
 * These are the authoritative RPC return shapes for all accounting domain reports.
 * Every consumer MUST import these interfaces; no ad-hoc payloads are permitted.
 *
 * Canonical report order & purpose:
 *   1. Trial Balance — per-account balances, must balance (debits = credits)
 *   2. Income Statement (P&L) — revenue minus expenses = net income
 *   3. Balance Sheet — assets = liabilities + equity
 *   4. Cash Flow — operating + investing + financing change
 *   5. Reconciliation — subledger vs GL variance analysis
 *   6. Statements — tenant/owner periodic statements
 *
 * DO NOT collapse unrelated payloads into generic interfaces.
 * Each report type has its own interface reflecting the authoritative RPC shape.
 */

import type { ChartAccount, AccountingPeriod, JournalLineInput, JournalEventInput } from '@/features/accounting/accountingDomain';
import type { Database } from '@/types/database';

/** Report filters common to all accounting period-backed reports. */
export type AccountingReportFilters = {
  company_id: string;
  as_of?: string;
  period_id?: string;
};

/** Trial Balance — per-account balances. */
export type TrialBalanceReport = {
  asOf: string | null;
  accounts: TrialBalanceAccount[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
};

export type TrialBalanceAccount = {
  code: string;
  name: string;
  type: string;
  balanceType: 'debit' | 'credit';
  balance: number; // OMR 3dp normalized
};

/** Income Statement (P&L) — revenue minus expenses. */
export type IncomeStatementReport = {
  period: { from: string | null; to: string | null };
  revenue: IncomeStatementLine[];
  totalRevenue: number;
  expenses: IncomeStatementLine[];
  totalExpenses: number;
  netIncome: number;
};

export type IncomeStatementLine = {
  label: string;
  amount: number; // OMR 3dp normalized
};

/** Balance Sheet — assets = liabilities + equity. */
export type BalanceSheetReport = {
  asOf: string | null;
  assets: BalanceSheetSectionItem[];
  totalAssets: number;
  liabilities: BalanceSheetSectionItem[];
  totalLiabilities: number;
  equity: BalanceSheetSectionItem[];
  totalEquity: number;
  isBalanced: boolean; // must satisfy assets = liabilities + equity
};

export type BalanceSheetSectionItem = {
  code: string;
  name: string;
  amount: number; // OMR 3dp normalized
};

/** Cash Flow — operating/investing/financing change period-over-period. */
export type CashFlowReport = {
  period: { from: string | null; to: string | null };
  openingCash: number;
  operating: number;
  investing: number;
  financing: number;
  unclassified: number;
  totalChange: number;
  closingCash: number;
  variance: number;
  isBalanced: boolean;
  currency: string;
};

export type CashFlowDrillthroughRow = {
  classification: string;
  account_id: string;
  account_no: string;
  account_name: string;
  batch_id: string;
  source_type: string;
  source_id: string;
  event_id: string;
  effective_date: string;
  posted_at: string | null;
  debit: number;
  credit: number;
  amount: number;
  line_description: string | null;
  ref_source_id: string | null;
  ref_entity_type: string | null;
  ref_entity_id: string | null;
};

/** Reconciliation — subledger vs GL variance analysis. */
export type ReconciliationRow = {
  reconciliation_class: string;
  account_no: string;
  account_name: string;
  subledger_balance: number; // OMR 3dp
  gl_balance: number; // OMR 3dp
  variance: number; // OMR 3dp = subledger - gl
  abs_variance: number; // OMR 3dp = |variance|
  currency: string;
  reconciliation_status: 'PASS' | 'FAIL';
  subledger_count: number;
  gl_count: number;
};

/** Statements — tenant/owner periodic statements. */
export type StatementReport = {
  asOf: string | null;
  company_id: string;
  period: { from: string | null; to: string | null };
  line_items: StatementLine[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
};

export type StatementLine = {
  account_no: string;
  account_name: string;
  debit: number; // OMR 3dp
  credit: number; // OMR 3dp
  description: string | null;
  effective_date: string | null;
};

/** Cash Flow Drillthrough — detailed line items behind a cash flow row. */
export type CashFlowPeriod = { from: string | null; to: string | null };

/** RPC response types for type-safe access. */
export type TrialBalanceRpcRow = {
  code: string | null;
  name: string | null;
  type: string | null;
  balance_type: string | null;
  balance: number | string | null;
};

export type IncomeStatementRpcResponse = {
  period?: { from: string | null; to: string | null };
  revenue?: Array<{ label: string | null; amount: number | string | null }>;
  expenses?: Array<{ label: string | null; amount: number | string | null }>;
};

export type BalanceSheetRpcResponse = {
  assets?: Array<{ code: string | null; name: string | null; amount: number | string | null }>;
  liabilities?: Array<{ code: string | null; name: string | null; amount: number | string | null }>;
  equity?: Array<{ code: string | null; name: string | null; amount: number | string | null }>;
};

export type CashFlowRpcResponse = {
  period?: { from: string | null; to: string | null };
  opening_cash?: number | string | null;
  operating?: number | string | null;
  investing?: number | string | null;
  financing?: number | string | null;
  unclassified?: number | string | null;
  total_change?: number | string | null;
  closing_cash?: number | string | null;
  variance?: number | string | null;
  is_balanced?: boolean | null;
  currency?: string | null;
};

export type ReconciliationRpcRow = {
  reconciliation_class: string | null;
  account_no: string | null;
  account_name: string | null;
  subledger_balance: number | string | null;
  gl_balance: number | string | null;
  variance: number | string | null;
  abs_variance: number | string | null;
  currency: string | null;
  reconciliation_status: string | null;
  subledger_count: number | string | null;
  gl_count: number | string | null;
};

export type StatementRpcResponse = {
  line_items?: Array<{
    account_no: string | null;
    account_name: string | null;
    debit: number | string | null;
    credit: number | string | null;
    description: string | null;
    effective_date: string | null;
  }>;
};