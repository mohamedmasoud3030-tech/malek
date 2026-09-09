/**
 * Accounting Reports — Reconciliation Service.
 *
 * Migration of accounting-reports-service.ts functions into the Accounting domain.
 * All monetary values are OMR 3dp, derived from the canonical shared monetary API.
 */

import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { reportMoneySchema as money, reportCountSchema as count } from '@/lib/report-value-schemas';
import type { ReconciliationRow } from '@/features/accounting/reports/contracts';

const rowSchema = z.object({
  reconciliation_class: z.string().trim().min(1),
  account_no: z.string().trim().min(1),
  account_name: z.string().nullable().transform(value => value?.trim() ?? ''),
  subledger_balance: money,
  gl_balance: money,
  variance: money,
  abs_variance: money.refine(value => value >= 0),
  currency: z.string().trim().min(1),
  reconciliation_status: z.enum(['PASS', 'FAIL']),
  subledger_count: count,
  gl_count: count,
});
const responseSchema = z.union([
  z.array(rowSchema),
  z.object({ rows: z.array(rowSchema) }).transform(value => value.rows),
]);

function todayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Run reconciliation as-of a given date (defaults to today). */
export async function getReconciliationReport(
  asOf?: string
): Promise<ReconciliationRow[]> {
  const p_as_of = asOf ?? todayIsoDate();
  const { data, error } = await supabase.rpc('wp05_reconcile_all', { p_as_of });
  if (error) throw error;

  return responseSchema.parse(data);
}
