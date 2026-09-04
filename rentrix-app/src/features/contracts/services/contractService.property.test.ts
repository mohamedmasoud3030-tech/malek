import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listContractsForProperties, listContractsForProperty } from './contractService';

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

describe('listContractsForProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of ['select', 'is', 'eq', 'order', 'in', 'returns']) mocks.query[name].mockReturnValue(mocks.query);
  });

  it('does not query when the property set is empty', async () => {
    await expect(listContractsForProperties([])).resolves.toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('deduplicates ids and batches large property sets instead of querying once per property', async () => {
    const propertyIds = Array.from({ length: 251 }, (_, index) => `p-${String(index).padStart(3, '0')}`);
    mocks.query.range
      .mockResolvedValueOnce({ data: [{ id: 'c-1', property_id: propertyIds[0] }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'c-2', property_id: propertyIds[250] }], error: null });

    const rows = await listContractsForProperties([...propertyIds, propertyIds[0]]);

    expect(rows).toHaveLength(2);
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.query.in).toHaveBeenCalledTimes(2);
    expect(mocks.query.in.mock.calls[0][1]).toHaveLength(250);
    expect(mocks.query.in.mock.calls[1][1]).toEqual([propertyIds[250]]);
    expect(mocks.query.is).toHaveBeenCalledWith('deleted_at', null);
  });
});
