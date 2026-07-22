/**
 * Read EVERY row of a filtered PostgREST query by paging forward with
 * `.range()`.
 *
 * PostgREST caps a single response at the server's max-rows setting (default
 * 1000) and it does so silently — a caller that skips pagination receives a
 * 1000-row prefix, and every total/KPI/export computed from it is quietly
 * wrong. This helper keeps fetching until a short page arrives, then reports
 * whether a safety ceiling stopped the walk early (`truncated`) so the UI can
 * say so instead of presenting partial numbers as complete.
 */
export type RangeQueryable<Row> = Readonly<{
  range: (from: number, to: number) => PromiseLike<{ data: readonly Row[] | null; error: unknown }>;
}>;

export type PagedReadResult<Row> = Readonly<{ rows: Row[]; truncated: boolean }>;

export const PAGED_READ_PAGE_SIZE = 1000;
/** Safety ceiling: 20 pages × 1000 rows = 20k rows max per read. */
export const PAGED_READ_MAX_PAGES = 20;

export async function fetchAllRows<Row>(
  createQuery: () => RangeQueryable<Row>,
  options: Readonly<{ pageSize?: number; maxPages?: number }> = {},
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

  return { rows, truncated: true };
}
