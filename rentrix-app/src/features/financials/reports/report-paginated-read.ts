import { fetchAllRows, type RangeQueryable } from '@/lib/paginatedRead';

const DEFAULT_REPORT_ID_BATCH_SIZE = 250;

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

/**
 * Keep `.in(...)` hydration queries below practical URL and PostgREST limits.
 */
export function chunkReportIds(
  values: readonly string[],
  batchSize = DEFAULT_REPORT_ID_BATCH_SIZE,
): string[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('حجم دفعة معرّفات التقرير يجب أن يكون عددًا صحيحًا موجبًا');
  }

  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    chunks.push(values.slice(index, index + batchSize));
  }
  return chunks;
}
