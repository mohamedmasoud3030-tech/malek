import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUnitWriteErrorMessage,
  normalizeUnitPayload,
  resolveUnitRentAmount,
  normalizeUnitRecord,
} from './unit-service';

function createQueryMock(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
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

  it('requires the parent property id in the Supabase insert contract', () => {
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
      notes: null,
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

  it('falls back to the older rent column when no default is available', () => {
    expect(resolveUnitRentAmount({
      rent_amount: 0,
      rent_default: null,
      rent: '80',
    })).toBe(80);
  });

  it('maps the historical rented unit status to occupied for all consuming views', () => {
    expect(normalizeUnitRecord({
      id: 'unit-1', property_id: 'property-1', unit_number: '101', floor: null,
      status: ' RENTED ', rent_amount: 500, notes: null,
    } as any).status).toBe('occupied');
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

  it('refuses to archive a unit that has contract history', async () => {
    const emptyChain = createQueryMock({ data: [], error: null });
    const contractsChain = createQueryMock({ data: [{ id: 'contract-1' }], error: null });
    supabaseMock.from.mockImplementation((table: string) => table === 'contracts' ? contractsChain : emptyChain);
    const { softDeleteUnit } = await import('./unit-service');

    await expect(softDeleteUnit('unit-1')).rejects.toThrow('مرتبطة بعقد محفوظ');
    expect(emptyChain.update).not.toHaveBeenCalled();
  });

  it('checks all contract history instead of only non-deleted contract rows', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./unit-service.ts', import.meta.url), 'utf8'));
    const archiveGuard = source.slice(source.indexOf('export async function softDeleteUnit'));

    expect(archiveGuard).toContain("from('contracts').select('id').eq('unit_id', unitId).limit(1)");
    expect(archiveGuard).not.toContain("eq('unit_id', unitId).is('deleted_at', null)");
  });
});
