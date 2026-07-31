import { describe, expect, it, vi } from 'vitest';
import {
  loadPeopleById,
  loadPropertiesById,
  loadUnitsById,
} from './financial-report-rows';

type ContextTable = 'properties' | 'people' | 'units';
type BatchLog = { table: ContextTable; ids: string[] };

function createContextSupabaseMock(failOnBatch?: number) {
  const batches: BatchLog[] = [];
  let batchNumber = 0;

  const from = vi.fn((table: ContextTable) => {
    let selectedIds: string[] = [];
    const builder = {
      select: vi.fn(() => builder),
      in: vi.fn((_column: string, ids: string[]) => {
        selectedIds = [...ids];
        batches.push({ table, ids: [...ids] });
        return builder;
      }),
      is: vi.fn(() => builder),
      returns: vi.fn(async () => {
        batchNumber += 1;
        if (batchNumber === failOnBatch) {
          return { data: null, error: new Error('context batch failed') };
        }

        const data = selectedIds.map((id) => {
          if (table === 'properties') return { id, title: `Property ${id}` };
          if (table === 'people') return { id, full_name: `Person ${id}` };
          return { id, unit_number: `Unit ${id}` };
        });
        return { data, error: null };
      }),
    };
    return builder;
  });

  return {
    supabase: { from } as never,
    batches,
    from,
  };
}

describe('financial report context hydration', () => {
  it('hydrates properties, people, and units in bounded batches without losing ids', async () => {
    const ids = Array.from({ length: 603 }, (_, index) => `id-${index}`);

    const propertyMock = createContextSupabaseMock();
    const properties = await loadPropertiesById(propertyMock.supabase, ids);
    expect(Array.from(properties.keys())).toEqual(ids);
    expect(propertyMock.batches.map((batch) => batch.ids.length)).toEqual([250, 250, 103]);
    expect(propertyMock.batches.every((batch) => batch.table === 'properties')).toBe(true);

    const peopleMock = createContextSupabaseMock();
    const people = await loadPeopleById(peopleMock.supabase, ids);
    expect(Array.from(people.keys())).toEqual(ids);
    expect(peopleMock.batches.map((batch) => batch.ids.length)).toEqual([250, 250, 103]);
    expect(peopleMock.batches.every((batch) => batch.table === 'people')).toBe(true);

    const unitMock = createContextSupabaseMock();
    const units = await loadUnitsById(unitMock.supabase, ids);
    expect(Array.from(units.keys())).toEqual(ids);
    expect(unitMock.batches.map((batch) => batch.ids.length)).toEqual([250, 250, 103]);
    expect(unitMock.batches.every((batch) => batch.table === 'units')).toBe(true);
  });

  it('does not query Supabase for an empty identifier list', async () => {
    const mock = createContextSupabaseMock();

    await expect(loadPropertiesById(mock.supabase, [])).resolves.toEqual(new Map());
    await expect(loadPeopleById(mock.supabase, [])).resolves.toEqual(new Map());
    await expect(loadUnitsById(mock.supabase, [])).resolves.toEqual(new Map());
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('fails the hydration instead of returning a partial context map', async () => {
    const ids = Array.from({ length: 300 }, (_, index) => `id-${index}`);
    const mock = createContextSupabaseMock(2);

    await expect(loadPropertiesById(mock.supabase, ids)).rejects.toThrow('context batch failed');
    expect(mock.batches.map((batch) => batch.ids.length)).toEqual([250, 50]);
  });
});
