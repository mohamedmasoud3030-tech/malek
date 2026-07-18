import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePropertyPayload } from './property-service';

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
      owner_name: null,
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

  it('throws actionable permission errors on create failures', async () => {
    const chain = createQueryMock({ data: null, error: new Error('permission denied for table properties') });
    supabaseMock.from.mockReturnValue(chain);
    const { createProperty } = await import('./property-service');

    await expect(createProperty({
      title: 'عمارة الندى',
      type: 'سكني',
      address: 'الخوير',
      owner_name: null,
      purchase_value: null,
      current_value: null,
      status: 'active',
      notes: null,
    })).rejects.toThrow('لا تملك صلاحية الكتابة على العقارات');
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'عمارة الندى', title: 'عمارة الندى' }));
  });

  it('archives properties with deleted_at instead of hard deleting', async () => {
    const chain = createQueryMock({ data: null, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { softDeleteProperty } = await import('./property-service');

    await softDeleteProperty('property-1');
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(chain.eq).toHaveBeenCalledWith('id', 'property-1');
  });
});
