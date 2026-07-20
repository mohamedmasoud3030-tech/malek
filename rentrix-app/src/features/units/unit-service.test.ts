import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUnitWriteErrorMessage,
  normalizeUnitPayload,
  normalizeUnitUpdatePayload,
  resolveUnitRentAmount,
} from './unit-service';

function createQueryMock(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    is: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(() => chain),
    update: vi.fn(() => chain),
    returns: vi.fn(() => Promise.resolve(result)),
  };

  return chain;
}

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('unit service write workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires the parent property id and synchronizes legacy default rent on insert', () => {
    expect(normalizeUnitPayload('property-1', {
      unit_number: '101',
      floor: null,
      status: 'available',
      rent_amount: 500,
      notes: null,
    })).toEqual({
      property_id: 'property-1',
      unit_number: '101',
      floor: null,
      status: 'available',
      rent_amount: 500,
      rent_default: 500,
      notes: null,
    });
  });

  it('synchronizes canonical and legacy rent fields on update', () => {
    expect(normalizeUnitUpdatePayload({
      unit_number: '101',
      floor: null,
      status: 'available',
      rent_amount: 125,
      notes: null,
    })).toMatchObject({
      rent_amount: 125,
      rent_default: 125,
    });
  });

  it('recovers a legacy saved rent when the canonical field was zeroed', () => {
    expect(resolveUnitRentAmount({
      rent_amount: 0,
      rent_default: 100,
      rent: null,
    })).toBe(100);
  });

  it('keeps a non-zero canonical rent ahead of legacy fields', () => {
    expect(resolveUnitRentAmount({
      rent_amount: 125,
      rent_default: 100,
      rent: 90,
    })).toBe(125);
  });

  it('returns an actionable duplicate-number message for the same property', () => {
    expect(getUnitWriteErrorMessage('create', {
      code: '23505',
      message: 'duplicate key value violates unique constraint units_property_unit_number_active_uidx',
    })).toContain('يوجد بالفعل وحدة بنفس الرقم داخل هذا العقار');
  });

  it('throws actionable permission errors on update failures', async () => {
    const chain = createQueryMock({ data: null, error: new Error('new row violates row-level security policy') });
    supabaseMock.from.mockReturnValue(chain);
    const { updateUnit } = await import('./unit-service');

    await expect(updateUnit('unit-1', {
      unit_number: '101',
      floor: null,
      status: 'available',
      rent_amount: null,
      notes: null,
    })).rejects.toThrow('لا تملك صلاحية الكتابة على الوحدات');
  });

  it('archives units with deleted_at instead of hard deleting', async () => {
    const chain = createQueryMock({ data: null, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { softDeleteUnit } = await import('./unit-service');

    await softDeleteUnit('unit-1');
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(chain.eq).toHaveBeenCalledWith('id', 'unit-1');
  });
});
