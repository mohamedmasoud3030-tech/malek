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
    maybeSingle: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => Promise.resolve(result)),
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
      notes: '',
    })).rejects.toThrow('تعذر تحديث العقارات: لا تملك صلاحية تنفيذ هذا الإجراء. تواصل مع المسؤول إذا كنت تحتاج هذه الصلاحية.');
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

describe('getProperty zero-row normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getPropertyQueryMock(result: { data: unknown; error: unknown }) {
    const chain = {
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      select: vi.fn(() => chain),
      single: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),
      returns: vi.fn(() => Promise.resolve(result)),
    };
    return chain;
  }

  it('returns null for a 200-empty response instead of a phantom truthy array', async () => {
    // A lenient server/proxy resolving 200 + [] used to reach the UI as a
    // truthy array, rendering a phantom property. Regression: the service
    // must return null so callers' truthiness checks mean "a real record".
    supabaseMock.from.mockReturnValue(getPropertyQueryMock({ data: [], error: null }));

    const { getProperty } = await import('./property-service');
    await expect(getProperty('not-a-real-id')).resolves.toBeNull();
  });

  it('returns null when maybeSingle finds no row', async () => {
    supabaseMock.from.mockReturnValue(getPropertyQueryMock({ data: null, error: null }));

    const { getProperty } = await import('./property-service');
    await expect(getProperty('not-a-real-id')).resolves.toBeNull();
  });

  it('returns the single row when exactly one exists', async () => {
    const row = { id: 'property-1', title: 'مجمع الخوير التجاري' };
    supabaseMock.from.mockReturnValue(getPropertyQueryMock({ data: [row], error: null }));

    const { getProperty } = await import('./property-service');
    await expect(getProperty('property-1')).resolves.toMatchObject(row);
  });

  it('propagates a real PostgREST error instead of inventing an empty property', async () => {
    const err = new Error('permission denied for table properties');
    supabaseMock.from.mockReturnValue(getPropertyQueryMock({ data: null, error: err }));

    const { getProperty } = await import('./property-service');
    await expect(getProperty('not-a-real-id')).rejects.toThrow();
  });
});

describe('listPropertyTitles paged read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getTitlesQueryMock() {
    const chain = {
      is: vi.fn(() => chain),
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      returns: vi.fn(() => chain),
      range: vi.fn(),
    };
    return chain;
  }

  it('orders titles deterministically and pages instead of taking the first 1000', async () => {
    const chain = getTitlesQueryMock();
    chain.range.mockResolvedValueOnce({
      data: [{ id: 'property-1', title: '  برج الموج  ' }, { id: 'property-2', title: '' }],
      error: null,
    });
    supabaseMock.from.mockReturnValue(chain);

    const { listPropertyTitles } = await import('./property-service');
    await expect(listPropertyTitles()).resolves.toEqual([{ id: 'property-1', title: 'برج الموج' }]);
    expect(chain.order).toHaveBeenNthCalledWith(1, 'title', { ascending: true });
    expect(chain.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(chain.range).toHaveBeenCalledWith(0, 999);
  });

  it('fails closed when the paged-read ceiling is exceeded', async () => {
    const chain = getTitlesQueryMock();
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `property-${index}`,
      title: `عقار ${index}`,
    }));
    chain.range.mockResolvedValue({ data: fullPage, error: null });
    supabaseMock.from.mockReturnValue(chain);

    const { listPropertyTitles } = await import('./property-service');
    await expect(listPropertyTitles()).rejects.toThrow('سقف الأمان');
  });
});

describe('softDeleteProperty legacy-status guard coverage', () => {
  function createArchiveChain() {
    const chain = {
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      in: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      select: vi.fn(() => chain),
      update: vi.fn(() => chain),
    };
    return chain;
  }

  it('blocks archival on every stored active/draft spelling, including legacy uppercase rows', async () => {
    const statusFilters: unknown[][] = [];
    const chain = createArchiveChain();
    chain.in = vi.fn((column: string, values: unknown[]) => {
      if (column === 'status') statusFilters.push(values);
      return chain;
    });
    supabaseMock.from.mockReturnValue(chain);

    const { softDeleteProperty } = await import('./property-service');
    await softDeleteProperty('property-1');

    const contractGuardFilter = statusFilters.find((values) => values.includes('active'));
    expect(contractGuardFilter).toBeDefined();
    expect(contractGuardFilter).toEqual(expect.arrayContaining(['active', 'ACTIVE', 'draft', 'DRAFT']));
  });

  it('rejects archival while any active or draft contract exists', async () => {
    const chain = createArchiveChain();
    chain.limit
      .mockResolvedValueOnce({ data: [], error: null } as never) // units
      .mockResolvedValueOnce({ data: [], error: null } as never) // owner agreements
      .mockResolvedValueOnce({ data: [], error: null } as never) // open maintenance
      .mockResolvedValueOnce({ data: [{ id: 'contract-1' }], error: null } as never); // active contract
    supabaseMock.from.mockReturnValue(chain);

    const { softDeleteProperty } = await import('./property-service');
    await expect(softDeleteProperty('property-1')).rejects.toThrow('عقد نشط أو مسودة');
  });
});
