import { createClient } from '@supabase/supabase-js';
import {
  createQueryClient,
  shouldRetryQuery,
} from '@/app/providers/query-client';
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

    await expect(
      fetchAllRows(() => query, { pageSize: 2, maxPages: 2 }),
    ).rejects.toBeInstanceOf(PagedReadTruncationError);
    await expect(
      fetchAllRows(() => query, { pageSize: 2, maxPages: 2 }),
    ).rejects.toThrow(/4 صفًا/);
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
    await expect(fetchAllRows(() => query, { pageSize: 2 })).rejects.toThrow(
      'read failed',
    );
  });
});

it.each([
  { pageSize: 0 },
  { maxPages: -1 },
  { pageSize: 1.5 },
  { maxPages: Infinity },
])(
  'rejects invalid pagination options before querying: %j',
  async (options) => {
    const query = fakeQuery([]);
    await expect(fetchAllRows(() => query, options)).rejects.toThrow();
    expect(query.range).not.toHaveBeenCalled();
  },
);

it.each(['42501', '23514', 'PGRST301'])(
  'preserves backend failure identity and metadata (%s)',
  async (code) => {
    const error = {
      code,
      message: 'backend failure',
      details: 'diagnostic evidence',
    };
    const query = { range: vi.fn(async () => ({ data: null, error })) };
    const caught = await fetchAllRows(() => query).catch((failure) => failure);
    expect(caught).toBe(error);
    expect(shouldRetryQuery(0, caught)).toBe(false);
  },
);

it('leaves retry ownership to the caller rather than multiplying transport retries', async () => {
  const query = {
    range: vi.fn(async () => ({ data: [1], error: null })),
    retry: vi.fn(),
  };
  query.retry.mockReturnValue(query);
  await expect(fetchAllRows(() => query)).resolves.toEqual({
    rows: [1],
    truncated: false,
  });
  expect(query.retry).toHaveBeenCalledExactlyOnceWith(false);
});

it('rejects an absent row payload rather than claiming known-empty data', async () => {
  await expect(
    fetchAllRows(() => ({ range: async () => ({ data: null, error: null }) })),
  ).rejects.toThrow();
  await expect(
    fetchAllRows(() => ({ range: async () => ({ data: [], error: null }) })),
  ).resolves.toEqual({ rows: [], truncated: false });
});

it.each([
  ['42501', 403, 1],
  ['503', 503, 3],
] as const)(
  'uses the existing query policy over the real SDK (%s)',
  async (code, status, attempts) => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ code, message: 'backend failure' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const api = createClient('https://pagination.invalid', 'public-test-key', {
      global: { fetch },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const client = createQueryClient();
    try {
      // Remove wall-clock delay only; retain the real retry-count/classification policy.
      await expect(
        client.fetchQuery({
          queryKey: ['pagination-protocol', code],
          retryDelay: 0,
          queryFn: () => fetchAllRows(() => api.from('expenses').select('id')),
        }),
      ).rejects.toMatchObject({ code });
      expect(fetch).toHaveBeenCalledTimes(attempts);
    } finally {
      client.clear();
    }
  },
);
