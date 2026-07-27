import { beforeEach, describe, expect, it, vi } from 'vitest';
import { derivePropertyWorkflowHealth, normalizePropertyPayload } from './property-service';

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

vi.mock("@/lib/supabase", () => ({
  supabase: supabaseMock,
}));

describe('property service write workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps validated form payloads to the Supabase insert contract', () => {
    expect(normalizePropertyPayload({
      title: 'عمارة الندى',
      type: 'سكني',
      address: 'الخوير',
      purchase_value: null,
      current_value: 1200,
      status: 'active',
      notes: null,
    })).toMatchObject({
      name: 'عمارة الندى',
      title: 'عمارة الندى',
      type: 'سكني',
      address: 'الخوير',
      status: 'active',
    });
  });

  it('throws actionable permission errors on update failures', async () => {
    const chain = createQueryMock({ data: null, error: new Error('permission denied for table properties') });
    supabaseMock.from.mockReturnValue(chain);
    const { updateProperty } = await import('./property-service');

    await expect(updateProperty('property-1', {
      title: 'عمارة الندى',
      type: 'سكني',
      address: 'الخوير',
      purchase_value: null,
      current_value: null,
      status: 'active',
      notes: null,
    })).rejects.toThrow('لا تملك صلاحية الكتابة على العقارات');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'عمارة الندى', title: 'عمارة الندى' }));
    expect(chain.eq).toHaveBeenCalledWith('id', 'property-1');
  });

  it('archives properties with deleted_at instead of hard deleting', async () => {
    const chain = createQueryMock({ data: null, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { softDeleteProperty } = await import('./property-service');

    await softDeleteProperty('property-1');
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(chain.eq).toHaveBeenCalledWith('id', 'property-1');
  });

  it('refuses to archive a property that still contains units', async () => {
    const emptyChain = createQueryMock({ data: [], error: null });
    const unitsChain = createQueryMock({ data: [{ id: 'unit-1' }], error: null });
    supabaseMock.from.mockImplementation((table: string) => table === 'units' ? unitsChain : emptyChain);
    const { softDeleteProperty } = await import('./property-service');

    await expect(softDeleteProperty('property-1')).rejects.toThrow('يحتوي على وحدات غير مؤرشفة');
    expect(emptyChain.update).not.toHaveBeenCalled();
  });
});

describe('property workflow health', () => {
  const owner = {
    display_name: 'مالك تشغيلي',
    full_name: 'مالك تشغيلي',
    name: 'مالك تشغيلي',
    deleted_at: null,
    is_active: true,
  };

  it('marks a property ready only with current ownership and agreement coverage', () => {
    expect(derivePropertyWorkflowHealth({
      property_owners: [{ owner_id: 'owner-1', is_primary: true, starts_on: null, ends_on: null, owner }],
      owner_agreements: [{ starts_on: '2026-01-01', ends_on: null }],
    } as never, '2026-07-27')).toEqual({
      workflow_health: 'ready',
      current_owner_name: 'مالك تشغيلي',
    });
  });

  it('treats a null ownership start as legacy unbounded coverage', () => {
    expect(derivePropertyWorkflowHealth({
      property_owners: [{ owner_id: 'owner-1', is_primary: true, starts_on: null, ends_on: null, owner }],
      owner_agreements: [{ starts_on: '2026-01-01', ends_on: null }],
    } as never, '2026-07-27')).toMatchObject({
      workflow_health: 'ready',
      current_owner_name: 'مالك تشغيلي',
    });
  });

  it('distinguishes an expired ownership link from an unavailable linked owner', () => {
    expect(derivePropertyWorkflowHealth({
      property_owners: [{ owner_id: 'owner-1', is_primary: true, starts_on: '2026-01-01', ends_on: '2026-06-30', owner }],
      owner_agreements: [{ starts_on: '2026-01-01', ends_on: null }],
    } as never, '2026-07-27')).toMatchObject({ workflow_health: 'missing_owner', current_owner_name: null });

    expect(derivePropertyWorkflowHealth({
      property_owners: [{ owner_id: 'owner-1', is_primary: true, starts_on: '2026-01-01', ends_on: null, owner: { ...owner, is_active: false } }],
      owner_agreements: [{ starts_on: '2026-01-01', ends_on: null }],
    } as never, '2026-07-27')).toMatchObject({
      workflow_health: 'owner_unavailable',
      current_owner_name: 'مالك تشغيلي',
    });
  });

  it('distinguishes a missing current agreement from a missing owner', () => {
    expect(derivePropertyWorkflowHealth({
      property_owners: [{ owner_id: 'owner-1', is_primary: true, starts_on: '2026-01-01', ends_on: null, owner }],
      owner_agreements: [{ starts_on: '2026-01-01', ends_on: '2026-06-30' }],
    } as never, '2026-07-27')).toMatchObject({
      workflow_health: 'missing_agreement',
      current_owner_name: 'مالك تشغيلي',
    });
  });
});
