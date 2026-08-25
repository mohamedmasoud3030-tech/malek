/**
 * Accounting Reports — Reconciliation Service.
 *
 * Migration of accounting-reports-service.ts functions into the Accounting domain.
 * All monetary values are OMR 3dp, derived from the canonical shared monetary API.
 */

import { supabase } from '@/lib/supabase';
import { roundMoney, normalizeOm3 } from '@/shared/monetary/monetaryContract';
import type { ReconciliationRow, ReconciliationRpcRow } from '@/features/accounting/reports/contracts';

// ---------------------------------------------------------------------------
// Reconciliation report logic
// ---------------------------------------------------------------------------

/** Row-level reconciliation data from the wp05_reconcile_all RPC. */
export type ReconciliationResult = ReconciliationRow;

/** Run reconciliation as-of a given date (defaults to today). */
export async function getReconciliationReport(
  asOf?: string
): Promise<ReconciliationRow[]> {
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

/** Assert that reconciliation is PASS for all classes as-of a date. */
export async function assertReconciliation(asOf?: string): Promise<{ success: boolean; details?: unknown }> {
  const { data, error } = await supabase.rpc('wp05_assert_reconciliation', { p_as_of: asOf ?? undefined });
  if (error) throw error;
  return { success: Boolean(data?.success), details: data };
}