import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listExpenses } from './expenseService';
import { PAGED_READ_PAGE_SIZE } from '@/lib/paginatedRead';

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['select', 'is', 'order', 'eq', 'gte', 'lte', 'returns', 'range']) query[name] = vi.fn();
  return { query, from: vi.fn(() => query), handleSupabaseError: vi.fn() };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/lib/supabase-error', () => ({ handleSupabaseError: mocks.handleSupabaseError }));

const expenseRow = (index: number) => ({ id: `expense-${index}`, property_id: 'property-1', category: 'صيانة', amount: 10 + index, expense_date: '2026-06-01' });

describe('listExpenses paged reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of ['select', 'is', 'order', 'eq', 'gte', 'lte', 'returns']) mocks.query[name].mockReturnValue(mocks.query);
  });

  it('walks past the silent 1000-row server cap and wires every filter', async () => {
    const fullPage = Array.from({ length: PAGED_READ_PAGE_SIZE }, (_, index) => expenseRow(index));
    mocks.query.range
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: [expenseRow(1000), expenseRow(1001)], error: null });

    const result = await listExpenses({ propertyId: 'property-1', category: 'صيانة', costCenterId: 'cc-1', from: '2026-01-01', to: '2026-06-30' });

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(PAGED_READ_PAGE_SIZE + 2);
    expect(mocks.query.range).toHaveBeenNthCalledWith(1, 0, PAGED_READ_PAGE_SIZE - 1);
    expect(mocks.query.range).toHaveBeenNthCalledWith(2, PAGED_READ_PAGE_SIZE, PAGED_READ_PAGE_SIZE * 2 - 1);
    expect(mocks.query.eq).toHaveBeenCalledWith('property_id', 'property-1');
    expect(mocks.query.eq).toHaveBeenCalledWith('category', 'صيانة');
    expect(mocks.query.eq).toHaveBeenCalledWith('cost_center_id', 'cc-1');
    expect(mocks.query.gte).toHaveBeenCalledWith('expense_date', '2026-01-01');
    expect(mocks.query.lte).toHaveBeenCalledWith('expense_date', '2026-06-30');
  });

  it('returns a single short page without an extra round trip', async () => {
    mocks.query.range.mockResolvedValueOnce({ data: [expenseRow(1)], error: null });

    const result = await listExpenses({ propertyId: '', category: '', from: '', to: '' });

    expect(result).toEqual({ rows: [expenseRow(1)], truncated: false });
    expect(mocks.query.range).toHaveBeenCalledTimes(1);
  });

  it('keeps the old error contract (toast + empty result) when a page fails', async () => {
    mocks.query.range.mockResolvedValueOnce({ data: null, error: new Error('boom') });

    const result = await listExpenses({ propertyId: '', category: '', from: '', to: '' });

    expect(result).toEqual({ rows: [], truncated: false });
    expect(mocks.handleSupabaseError).toHaveBeenCalledWith(expect.any(Error), 'تعذر تحميل المصاريف');
  });
});
