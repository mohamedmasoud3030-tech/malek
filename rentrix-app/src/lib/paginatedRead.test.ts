import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows, PagedReadTruncationError } from './paginatedRead';

function fakeQuery(pages: readonly (readonly number[] | { error: true })[]) {
  const range = vi.fn(async (from: number, to: number) => {
    const pageIndex = from / (to - from + 1);
    const page = pages[pageIndex] ?? [];
    if ('error' in page) return { data: null, error: new Error('read failed') };
    return { data: [...page], error: null };
  });
  return { range };
}

describe('fetchAllRows', () => {
  it('concatenates pages until a short page arrives', async () => {
    // 2 full pages of 2 + a final short page — nothing left after it
    const query = fakeQuery([[1, 2], [3, 4], [5], []]);
    const result = await fetchAllRows(() => query, { pageSize: 2 });

    expect(result).toEqual({ rows: [1, 2, 3, 4, 5], truncated: false });
    expect(query.range).toHaveBeenCalledTimes(3);
    // PostgREST semantics: the FIRST partial page ends the walk, no empty read
    expect(query.range).toHaveBeenNthCalledWith(3, 4, 5);
  });

  it('does not request a second page when the first is already short', async () => {
    const query = fakeQuery([[1], []]);
    const result = await fetchAllRows(() => query, { pageSize: 2 });

    expect(result).toEqual({ rows: [1], truncated: false });
    expect(query.range).toHaveBeenCalledTimes(1);
  });

  it('fails closed by default when the safety ceiling is reached', async () => {
    const query = fakeQuery([[1, 2], [3, 4], [5, 6], [7]]);

    await expect(fetchAllRows(() => query, { pageSize: 2, maxPages: 2 }))
      .rejects.toBeInstanceOf(PagedReadTruncationError);
    await expect(fetchAllRows(() => query, { pageSize: 2, maxPages: 2 }))
      .rejects.toThrow(/4 صفًا/);
  });

  it('returns an explicit truncated result only for callers that opt in', async () => {
    const query = fakeQuery([[1, 2], [3, 4], [5, 6], [7]]);
    const result = await fetchAllRows(() => query, {
      pageSize: 2,
      maxPages: 2,
      allowTruncated: true,
    });

    expect(result).toEqual({ rows: [1, 2, 3, 4], truncated: true });
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('propagates query errors instead of returning silent partial data', async () => {
    const query = fakeQuery([[1, 2], { error: true }]);
    await expect(fetchAllRows(() => query, { pageSize: 2 })).rejects.toThrow('read failed');
  });
});
