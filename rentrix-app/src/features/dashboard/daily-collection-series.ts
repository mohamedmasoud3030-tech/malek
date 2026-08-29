/**
 * Command center — daily collection series.
 *
 * The collection sparkline needs historical shape, and the database already
 * exposes an authoritative, company-isolated daily aggregate:
 * public.rpt_daily_collection(p_from, p_to). The browser never sums payment
 * rows itself; it renders exactly what the RPC returns, and an empty/failed
 * series hides the sparkline instead of inventing a trend.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type DailyCollectionPoint = Readonly<{
  date: string;
  total: number;
}>;

export type DailyCollectionSeries = Readonly<{
  rows: readonly DailyCollectionPoint[];
  total: number;
}>;

export const EMPTY_DAILY_COLLECTION_SERIES: DailyCollectionSeries = {
  rows: [],
  total: 0,
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeDailyCollectionSeries(data: unknown): DailyCollectionSeries {
  const raw = asRecord(data);
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const points: DailyCollectionPoint[] = [];

  for (const row of rows) {
    const record = asRecord(row);
    const date = typeof record.date === 'string' ? record.date : '';
    if (!date) continue;
    points.push({ date, total: toNumber(record.total) });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return { rows: points, total: toNumber(raw.total) };
}

export async function getDailyCollectionSeries(dateFrom: string, dateTo: string): Promise<DailyCollectionSeries> {
  const { data, error } = await supabase.rpc('rpt_daily_collection', {
    p_from: dateFrom,
    p_to: dateTo,
  });
  if (error) throw error;
  return normalizeDailyCollectionSeries(data);
}

export function useDailyCollectionSeries(dateFrom: string, dateTo: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['dashboard', 'daily-collection-series', dateFrom, dateTo],
    queryFn: () => getDailyCollectionSeries(dateFrom, dateTo),
    retry: false,
    enabled: options?.enabled ?? true,
  });
}
