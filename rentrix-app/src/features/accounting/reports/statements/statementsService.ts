/**
 * Accounting Reports — Statements Service.
 *
 * Migration of statements-reports-service.ts functions into the Accounting domain.
 * All monetary values are OMR 3dp, derived from the canonical shared monetary API.
 */

import { supabase } from '@/lib/supabase';
import { roundMoney, normalizeOm3 } from '@/shared/monetary/monetaryContract';
import type { StatementReport, StatementLine, StatementRpcResponse } from '@/features/accounting/reports/contracts';

// ---------------------------------------------------------------------------
// Statements report logic (tenant/owner periodic statements)
// ---------------------------------------------------------------------------

/** Run statement report for a company as-of a given date. */
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
    period: { from: '', to: '' }, // callers should fill period if needed
    line_items,
    total_debits: totalDebits,
    total_credits: totalCredits,
    is_balanced: isBalanced,
  };
}

/** Get line items for a statement report. */
export type StatementLineItem = {
  account_no: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string | null;
  effective_date: string | null;
};

/** Build a statement report from raw line items (pure function, no RPC). */
export function buildStatementReport(
  company_id: string,
  asOf: string,
  line_items: StatementLineItem[]
): StatementReport {
  const totalDebits = line_items.reduce((sum: number, item) => sum + item.debit, 0);
  const totalCredits = line_items.reduce((sum: number, item) => sum + item.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

  return {
    asOf,
    company_id,
    period: { from: '', to: '' },
    line_items,
    total_debits: totalDebits,
    total_credits: totalCredits,
    is_balanced: isBalanced,
  };
}