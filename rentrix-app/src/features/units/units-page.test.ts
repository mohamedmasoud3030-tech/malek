import { describe, expect, it } from 'vitest';
import type { Unit } from '@/types/domain';
import { getUnitPageStatus, computeUnitKpis } from './use-units-list-controller';

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-1',
    name: null,
    property_id: 'property-1',
    unit_number: '101',
    floor: null,
    status: 'available',
    rent_amount: 100,
    notes: null,
    created_at: '2026-06-03T00:00:00.000Z',
    updated_at: '2026-06-03T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('units page status invariants', () => {
  it('uses the strict unit status invariant for display status', () => {
    expect(getUnitPageStatus(makeUnit({ status: 'OCCUPIED' as Unit['status'] }))).toBe('occupied');
    expect(() => getUnitPageStatus(makeUnit({ status: 'corrupted-status' as Unit['status'] }))).toThrow('Unsupported unit status: corrupted-status');
  });

  it('does not count unsupported statuses as available units', () => {
    const units = [
      makeUnit({ id: 'unit-available', status: 'available' }),
      makeUnit({ id: 'unit-corrupted', status: 'corrupted-status' as Unit['status'] }),
    ];

    expect(() => computeUnitKpis(units)).toThrow('Unsupported unit status: corrupted-status');
  });
});
