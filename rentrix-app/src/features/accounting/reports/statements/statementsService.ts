/**
 * Accounting Reports — Statements Service.
 *
 * The repository has authoritative tenant and owner statement RPCs, but no
 * aggregate `rpt_statements` RPC in the generated Supabase contract. Keep the
 * aggregate compatibility surface fail-closed until a canonical adapter is
 * defined instead of issuing a request to a non-existent RPC.
 */

import type { StatementReport } from '@/features/accounting/reports/contracts';

/**
 * Aggregate statement report compatibility surface.
 *
 * There is no authoritative aggregate statement RPC today. Callers must keep
 * using the existing tenant/owner statement services until that contract is
 * explicitly introduced.
 */
export async function getStatementReport(
  company_id: string,
  asOf?: string
): Promise<StatementReport> {
  void company_id;
  void asOf;
  throw new Error(
    'Aggregate statement report is not available in the current database contract; ' +
      'use the canonical tenant/owner statement reports instead.'
  );
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
  const totalDebits = line_items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredits = line_items.reduce((sum, item) => sum + item.credit, 0);
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
