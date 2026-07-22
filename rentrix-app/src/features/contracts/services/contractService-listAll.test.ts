import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAllContracts } from './contractService';
import { PAGED_READ_PAGE_SIZE } from '@/lib/paginatedRead';

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['select', 'is', 'order', 'in', 'returns', 'range']) query[name] = vi.fn();
  return { query, from: vi.fn(() => query) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

const contractRow = (index: number) => ({ id: `contract-${index}`, status: 'active' });

describe('listAllContracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of ['select', 'is', 'order', 'in', 'returns']) mocks.query[name].mockReturnValue(mocks.query);
  });

  it('walks every page and skips the status filter for the all view', async () => {
    const fullPage = Array.from({ length: PAGED_READ_PAGE_SIZE }, (_, index) => contractRow(index));
    mocks.query.range
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: [contractRow(1000)], error: null });

    const result = await listAllContracts('all');

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(PAGED_READ_PAGE_SIZE + 1);
    expect(mocks.query.in).not.toHaveBeenCalled();
    expect(mocks.query.is).toHaveBeenCalledWith('deleted_at', null);
    expect(mocks.query.range).toHaveBeenNthCalledWith(2, PAGED_READ_PAGE_SIZE, PAGED_READ_PAGE_SIZE * 2 - 1);
  });

  it('filters by every stored status casing when a status is picked', async () => {
    mocks.query.range.mockResolvedValueOnce({ data: [], error: null });

    await listAllContracts('active');

    expect(mocks.query.in).toHaveBeenCalledWith('status', ['active', 'ACTIVE']);
    expect(mocks.query.range).toHaveBeenCalledTimes(1);
  });

  it('propagates query errors so partial data never reaches reports', async () => {
    mocks.query.range.mockResolvedValueOnce({ data: null, error: new Error('read failed') });

    await expect(listAllContracts('all')).rejects.toThrow('read failed');
  });
});
