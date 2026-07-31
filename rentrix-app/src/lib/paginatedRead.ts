/**
 * Read EVERY row of a filtered PostgREST query by paging forward with
 * `.range()`.
 *
 * PostgREST caps a single response at the server's max-rows setting (default
 * 1000) and it does so silently — a caller that skips pagination receives a
 * 1000-row prefix, and every total/KPI/export computed from it is quietly
 * wrong. This helper keeps fetching until a short page arrives.
 *
 * Reaching the safety ceiling fails closed by default. A caller may opt into a
 * partial result only when its public contract exposes `truncated` and its UI
 * visibly warns the user instead of presenting partial rows as complete.
 */
export type RangeQueryable<Row> = Readonly<{
  range: (from: number, to: number) => PromiseLike<{ data: readonly Row[] | null; error: unknown }>;
}>;

export type PagedReadResult<Row> = Readonly<{ rows: Row[]; truncated: boolean }>;

export type PagedReadOptions = Readonly<{
  pageSize?: number;
  maxPages?: number;
  allowTruncated?: boolean;
}>;

export const PAGED_READ_PAGE_SIZE = 1000;
/** Safety ceiling: 20 pages × 1000 rows = 20k rows max per read. */
export const PAGED_READ_MAX_PAGES = 20;
/** Keep PostgREST `.in(...)` filters below practical URL and parser limits. */
export const IN_FILTER_BATCH_SIZE = 250;

export class PagedReadTruncationError extends Error {
  constructor(maxRows: number) {
    super(`تعذر تحميل كامل البيانات: تجاوزت القراءة سقف الأمان البالغ ${maxRows} صفًا. قلّل نطاق البحث أو استخدم تقريرًا خادميًا مجمّعًا.`);
    this.name = 'PagedReadTruncationError';
  }
}

export function chunkForInFilter<Value>(
  values: readonly Value[],
  batchSize = IN_FILTER_BATCH_SIZE,
): Value[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('حجم دفعة معرّفات القراءة يجب أن يكون عددًا صحيحًا موجبًا');
  }

  const chunks: Value[][] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    chunks.push(values.slice(index, index + batchSize));
  }
  return chunks;
}

export async function fetchAllRows<Row>(
  createQuery: () => RangeQueryable<Row>,
  options: PagedReadOptions = {},
): Promise<PagedReadResult<Row>> {
  const pageSize = options.pageSize ?? PAGED_READ_PAGE_SIZE;
  const maxPages = options.maxPages ?? PAGED_READ_MAX_PAGES;
  const rows: Row[] = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const from = pageIndex * pageSize;
    const { data, error } = await createQuery().range(from, from + pageSize - 1);
    if (error) throw error instanceof Error ? error : new Error('تعذر إكمال قراءة الصفوف المرحّلة');
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { rows, truncated: false };
  }

  if (!options.allowTruncated) {
    throw new PagedReadTruncationError(pageSize * maxPages);
  }

  return { rows, truncated: true };
}

export async function fetchAllRowsInBatches<Row, Value>(
  values: readonly Value[],
  createQuery: (batch: readonly Value[]) => RangeQueryable<Row>,
  options: PagedReadOptions = {},
): Promise<PagedReadResult<Row>> {
  const rows: Row[] = [];
  let truncated = false;

  for (const batch of chunkForInFilter(values)) {
    const result = await fetchAllRows(() => createQuery(batch), options);
    rows.push(...result.rows);
    truncated ||= result.truncated;
  }

  return { rows, truncated };
}
