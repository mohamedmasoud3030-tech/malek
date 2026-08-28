import { supabase } from '@/lib/supabase';

export type ShortStayReconciliationResult = Readonly<{
  status: 'reconciled';
  expired_contracts: number;
  released_units: number;
  as_of: string;
}>;

/**
 * Reconcile date-driven Short Stay checkout state before operational reads.
 *
 * This is not a user-authored mutation: the server decides the current company,
 * which contracts are due, and which occupied units are safe to release. The
 * browser supplies no company, contract, unit, date, status or amount.
 */
export async function reconcileDueShortStays(): Promise<ShortStayReconciliationResult> {
  // Generated DB types are refreshed from migrations by db0:gen-types. Until
  // that canonical generation runs, keep this newly-added RPC behind the same
  // narrow compatibility cast used for other migration-ahead seams.
  const { data, error } = await (supabase as any).rpc('reconcile_due_short_stays_atomic');
  if (error) throw error;
  if (!data || typeof data !== 'object' || data.status !== 'reconciled') {
    throw new Error('استجابة غير صالحة من مزامنة انتهاء الإقامة القصيرة');
  }
  return data as ShortStayReconciliationResult;
}

/**
 * A failed reconciliation must never hide the underlying read. Server-side
 * authorization still protects every table read; this helper merely prevents
 * a transient maintenance failure from blanking the whole workspace.
 */
export async function reconcileDueShortStaysBeforeRead(): Promise<void> {
  try {
    await reconcileDueShortStays();
  } catch (error) {
    console.warn('Short Stay reconciliation skipped before read', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
