import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listContractsForProperty } from './contractService';

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['select', 'is', 'eq', 'order', 'in', 'returns', 'range']) query[name] = vi.fn();
  return { query, from: vi.fn(() => query) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

describe('listContractsForProperty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of ['select', 'is', 'eq', 'order', 'in', 'returns']) {
      mocks.query[name].mockReturnValue(mocks.query);
    }
  });

  it('reads every contract for one property instead of the first company page', async () => {
    mocks.query.range.mockResolvedValueOnce({
      data: [{ id: 'contract-1', property_id: 'p1' }],
      error: null,
    });

    const rows = await listContractsForProperty('p1');

    expect(rows).toEqual([{ id: 'contract-1', property_id: 'p1' }]);
    expect(mocks.from).toHaveBeenCalledWith('contracts');
    expect(mocks.query.eq).toHaveBeenCalledWith('property_id', 'p1');
    expect(mocks.query.is).toHaveBeenCalledWith('deleted_at', null);
    expect(mocks.query.range).toHaveBeenCalledWith(0, 999);
  });
});
