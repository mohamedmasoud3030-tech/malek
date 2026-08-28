import { describe, expect, it } from 'vitest';
import type { Unit } from '@/types/domain';
import {
  buildVacantUnitsSignal,
  EMPTY_VACANT_UNITS_SIGNAL,
  VACANT_UNITS_ROW_LIMIT,
} from './vacant-units-signal';

function unit(overrides: Partial<Unit> & { id: string }): Unit {
  return {
    id: overrides.id,
    property_id: 'property-1',
    unit_number: '1',
    floor: null,
    status: 'available',
    rent_amount: 250,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Unit;
}

const titles = new Map([
  ['property-1', 'برج الخليج'],
  ['property-2', 'واحة مسقط'],
]);

describe('Today vacant and out-of-service units signal (P3)', () => {
  it('stays neutral when there is nothing to read', () => {
    expect(buildVacantUnitsSignal(undefined, titles)).toBe(EMPTY_VACANT_UNITS_SIGNAL);
    expect(buildVacantUnitsSignal([], titles)).toBe(EMPTY_VACANT_UNITS_SIGNAL);
  });

  it('keeps occupied units out of the attention queue entirely', () => {
    const signal = buildVacantUnitsSignal(
      [unit({ id: 'a', status: 'occupied' }), unit({ id: 'b', status: 'occupied' })],
      titles,
    );
    expect(signal).toBe(EMPTY_VACANT_UNITS_SIGNAL);
  });

  it('separates vacant, out-of-service and held units instead of one blended number', () => {
    const signal = buildVacantUnitsSignal(
      [
        unit({ id: 'a', status: 'available' }),
        unit({ id: 'b', status: 'available' }),
        unit({ id: 'c', status: 'maintenance' }),
        unit({ id: 'd', status: 'reserved' }),
        unit({ id: 'e', status: 'occupied' }),
      ],
      titles,
    );

    expect(signal.availableCount).toBe(2);
    expect(signal.outOfServiceCount).toBe(1);
    expect(signal.reservedCount).toBe(1);
    expect(signal.attentionCount).toBe(4);
  });

  it('shows the operational problem before the letting opportunity', () => {
    const signal = buildVacantUnitsSignal(
      [
        unit({ id: 'reserved', status: 'reserved', unit_number: '9' }),
        unit({ id: 'vacant', status: 'available', unit_number: '4' }),
        unit({ id: 'broken', status: 'maintenance', unit_number: '2' }),
      ],
      titles,
    );

    expect(signal.rows.map((row) => row.unitId)).toEqual(['broken', 'vacant', 'reserved']);
    expect(signal.rows[0].statusLabel).toBe('متوقفة للصيانة');
  });

  it('names the property behind each unit and degrades honestly when unknown', () => {
    const signal = buildVacantUnitsSignal(
      [
        unit({ id: 'a', unit_number: '5', property_id: 'property-2' }),
        unit({ id: 'b', unit_number: '6', property_id: 'property-unknown' }),
      ],
      titles,
    );

    expect(signal.rows.find((row) => row.unitId === 'a')).toMatchObject({ title: 'وحدة 5', location: 'واحة مسقط' });
    expect(signal.rows.find((row) => row.unitId === 'b')).toMatchObject({ title: 'وحدة 6', location: 'عقار غير محدد' });
  });

  it('treats reference rent as optional context, never as an invented zero', () => {
    const signal = buildVacantUnitsSignal(
      [unit({ id: 'a', rent_amount: 0 }), unit({ id: 'b', unit_number: '2', rent_amount: 310 })],
      titles,
    );

    expect(signal.rows.find((row) => row.unitId === 'a')?.referenceRent).toBeNull();
    expect(signal.rows.find((row) => row.unitId === 'b')?.referenceRent).toBe(310);
  });

  it('bounds the rows without shrinking the counted totals', () => {
    const units = Array.from({ length: 9 }, (_, index) =>
      unit({ id: `unit-${index}`, unit_number: String(index), status: 'available' }),
    );

    const signal = buildVacantUnitsSignal(units, titles);

    expect(signal.rows).toHaveLength(VACANT_UNITS_ROW_LIMIT);
    expect(signal.availableCount).toBe(9);
    expect(signal.attentionCount).toBe(9);
  });
});
