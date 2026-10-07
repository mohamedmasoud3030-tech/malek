import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listBankStatementLines } from './bankReconciliationService';
import { PAGED_READ_PAGE_SIZE } from '@/lib/paginatedRead';

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['select', 'is', 'order', 'eq', 'in', 'gte', 'lte', 'returns', 'range']) query[name] = vi.fn();
  return { query, from: vi.fn(() => query) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/lib/supabase-error', () => ({ handleSupabaseError: vi.fn() }));

const noFilter = { bankAccountId: '', status: 'all' as const, from: '', to: '' };
const line = (index: number) => ({ id: `line-${index}`, transaction_date: '2026-07-01', status: 'unmatched' as const, amount: 10 });

describe('listBankStatementLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of ['select', 'is', 'order', 'eq', 'in', 'gte', 'lte', 'returns']) mocks.query[name].mockReturnValue(mocks.query);
  });

  it('walks every page and applies a stable id tie-break after transaction_date', async () => {
    const fullPage = Array.from({ length: PAGED_READ_PAGE_SIZE }, (_, index) => line(index));
    mocks.query.range
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: [line(1000)], error: null });

    const result = await listBankStatementLines(noFilter);

    expect(result).toHaveLength(PAGED_READ_PAGE_SIZE + 1);
    // transaction_date ties are common (many lines land on the same day) —
    // pagination must not rely on transaction_date alone.
    expect(mocks.query.order).toHaveBeenCalledWith('transaction_date', { ascending: false });
    expect(mocks.query.order).toHaveBeenCalledWith('id', { ascending: false });
    expect(mocks.query.range).toHaveBeenNthCalledWith(2, PAGED_READ_PAGE_SIZE, PAGED_READ_PAGE_SIZE * 2 - 1);
  });

  it('propagates query errors so partial statement lines never reach reconciliation totals', async () => {
    mocks.query.range.mockResolvedValueOnce({ data: null, error: new Error('read failed') });

    await expect(listBankStatementLines(noFilter)).rejects.toThrow('read failed');
  });
});
