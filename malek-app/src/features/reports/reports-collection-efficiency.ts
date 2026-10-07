import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type CollectionEfficiencyRange = Readonly<{
  from: string;
  to: string;
}>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Reports collection efficiency deliberately reuses the Dashboard Truth RPC.
 * R13 made rpt_dashboard_snapshot.collections.collection_rate the canonical
 * invoice-cohort realization metric (credit-aware and cohort-coherent). Reports
 * must render that value; they must never recompute period cash / period invoice
 * issue in the browser.
 */
export async function getAuthoritativeReportsCollectionRate(
  range: CollectionEfficiencyRange,
): Promise<number> {
  if (!range.from || !range.to || range.from > range.to) {
    throw new Error('نطاق كفاءة التحصيل غير صالح.');
  }

  const { data, error } = await supabase.rpc('rpt_dashboard_snapshot', {
    p_from: range.from,
    p_to: range.to,
    // collection_rate itself is cohort-scoped by p_from/p_to; p_as_of is
    // supplied deterministically because the shared snapshot also contains
    // as-of KPIs that Reports does not reinterpret here.
    p_as_of: range.to,
  });

  if (error) throw error;

  const collections = asRecord(asRecord(data).collections);
  const rawRate = collections.collection_rate;
  // Number(null) === 0, so absence must be rejected before numeric coercion;
  // otherwise an unavailable authoritative metric would be presented as 0%.
  if (rawRate === null || rawRate === undefined || rawRate === '') {
    throw new Error('تعذر قراءة كفاءة التحصيل المعتمدة من الخادم.');
  }
  const rate = Number(rawRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error('تعذر قراءة كفاءة التحصيل المعتمدة من الخادم.');
  }

  return rate;
}

export function useAuthoritativeReportsCollectionRate(
  range: CollectionEfficiencyRange,
  enabled = true,
) {
  return useQuery({
    queryKey: ['reports', 'authoritative-collection-rate', range.from, range.to],
    queryFn: () => getAuthoritativeReportsCollectionRate(range),
    enabled: enabled && Boolean(range.from && range.to),
  });
}
