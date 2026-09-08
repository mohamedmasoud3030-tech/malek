import { fetchAllRows, type RangeQueryable } from '@/lib/paginatedRead';

/**
 * Financial reports must never present partial totals as complete.
 *
 * `fetchAllRows` protects against PostgREST's per-response row cap. This
 * adapter opts into receiving the explicit `truncated` flag only so it can
 * replace the generic guardrail message with a report-specific action.
 */
export async function fetchCompleteReportRows<Row>(
  createQuery: () => RangeQueryable<Row>,
  label: string,
): Promise<Row[]> {
  const { rows, truncated } = await fetchAllRows(createQuery, { allowTruncated: true });
  if (truncated) {
    throw new Error(`تعذر تحميل كامل بيانات ${label}. قلّل الفترة أو استخدم تقريرًا خادميًا مجمّعًا.`);
  }
  return rows;
}
