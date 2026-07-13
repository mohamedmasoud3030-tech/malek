import { supabase } from '@/lib/supabase';

export type TrialBalanceAccount = { code: string; name: string; type: string; balanceType: 'debit' | 'credit'; balance: number };
export type TrialBalanceReport = { asOf: string | null; accounts: TrialBalanceAccount[]; totalDebits: number; totalCredits: number; isBalanced: boolean };
export type IncomeStatementLine = { label: string; amount: number };
export type IncomeStatementReport = { period: { from: string | null; to: string | null }; revenue: IncomeStatementLine[]; totalRevenue: number; expenses: IncomeStatementLine[]; totalExpenses: number; netIncome: number };
export type BalanceSheetSectionItem = { code: string; name: string; amount: number };
export type BalanceSheetReport = { asOf: string | null; assets: BalanceSheetSectionItem[]; totalAssets: number; liabilities: BalanceSheetSectionItem[]; totalLiabilities: number; equity: BalanceSheetSectionItem[]; totalEquity: number; isBalanced: boolean };

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
const asString = (value: unknown): string | null => typeof value === 'string' ? value : null;

export function normalizeTrialBalanceReport(payload: unknown): TrialBalanceReport {
  const root = asRecord(payload);
  return { asOf: asString(root.as_of), accounts: asArray(root.accounts).map((value) => { const row = asRecord(value); return { code: asString(row.code) ?? '', name: asString(row.name) ?? '', type: asString(row.type) ?? '', balanceType: asString(row.balance_type) === 'credit' ? 'credit' : 'debit', balance: asNumber(row.balance) }; }), totalDebits: asNumber(root.total_debits), totalCredits: asNumber(root.total_credits), isBalanced: Boolean(root.is_balanced) };
}

export function normalizeIncomeStatementReport(payload: unknown): IncomeStatementReport {
  const root = asRecord(payload);
  const lines = (value: unknown): IncomeStatementLine[] => asArray(value).map((item) => { const row = asRecord(item); return { label: asString(row.label) ?? '', amount: asNumber(row.amount) }; });
  const period = asRecord(root.period);
  return { period: { from: asString(period.from), to: asString(period.to) }, revenue: lines(root.revenue), totalRevenue: asNumber(root.total_revenue), expenses: lines(root.expenses), totalExpenses: asNumber(root.total_expenses), netIncome: asNumber(root.net_income) };
}

export function normalizeBalanceSheetReport(payload: unknown): BalanceSheetReport {
  const root = asRecord(payload);
  const section = (value: unknown): BalanceSheetSectionItem[] => asArray(value).map((item) => { const row = asRecord(item); return { code: asString(row.code) ?? '', name: asString(row.name) ?? '', amount: asNumber(row.amount) }; });
  return { asOf: asString(root.as_of), assets: section(root.assets), totalAssets: asNumber(root.total_assets), liabilities: section(root.liabilities), totalLiabilities: asNumber(root.total_liabilities), equity: section(root.equity), totalEquity: asNumber(root.total_equity), isBalanced: Boolean(root.is_balanced) };
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
export async function getTrialBalanceReport(asOf: string) { const { data, error } = await (supabase.rpc as unknown as Rpc)('rpt_trial_balance', { p_as_of: asOf }); if (error) throw error; return normalizeTrialBalanceReport(data); }
export async function getIncomeStatementReport(filters: { dateFrom: string; dateTo: string }) { const { data, error } = await (supabase.rpc as unknown as Rpc)('rpt_income_statement', { p_from: filters.dateFrom, p_to: filters.dateTo }); if (error) throw error; return normalizeIncomeStatementReport(data); }
export async function getBalanceSheetReport(asOf: string) { const { data, error } = await (supabase.rpc as unknown as Rpc)('rpt_balance_sheet', { p_as_of: asOf }); if (error) throw error; return normalizeBalanceSheetReport(data); }
