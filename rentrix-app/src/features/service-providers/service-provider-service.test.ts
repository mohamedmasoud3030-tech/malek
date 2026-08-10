import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyServiceProviderFormValues, serviceProviderFormSchema } from './service-provider-schema';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

describe('Service Provider service boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes optional contact and operational fields without manufacturing defaults', async () => {
    const { toServiceProviderPayload } = await import('./service-provider-service');
    const result = toServiceProviderPayload({
      ...emptyServiceProviderFormValues,
      name: '  شركة الصيانة  ',
      phone: '  99999999  ',
      email: '',
      service_area: '  مسقط  ',
      category_ids: [
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
      ],
    });

    expect(result.payload).toMatchObject({
      name: 'شركة الصيانة',
      phone: '99999999',
      email: null,
      service_area: 'مسقط',
      is_active: true,
    });
    expect(result.categoryIds).toEqual(['10000000-0000-4000-8000-000000000001']);
  });

  it('rejects invalid email, website, and overlong fields at the service schema', () => {
    expect(() => serviceProviderFormSchema.parse({ ...emptyServiceProviderFormValues, name: 'مزود', email: 'bad' })).toThrow(/بريد/);
    expect(() => serviceProviderFormSchema.parse({ ...emptyServiceProviderFormValues, name: 'مزود', website: 'example' })).toThrow(/رابط/);
    expect(() => serviceProviderFormSchema.parse({ ...emptyServiceProviderFormValues, name: 'x'.repeat(201) })).toThrow(/طويل/);
  });

  it('saves provider data and category assignments through one atomic RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { provider: { id: 'provider-1', name: 'مزود', is_active: true }, category_ids: [] },
      error: null,
    });
    const { saveServiceProvider } = await import('./service-provider-service');

    const result = await saveServiceProvider(null, { ...emptyServiceProviderFormValues, name: 'مزود' });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('save_service_provider_atomic', {
      p_provider_id: null,
      p_payload: expect.objectContaining({ name: 'مزود', is_active: true }),
      p_category_ids: [],
    });
    expect(result.id).toBe('provider-1');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('surfaces atomic save permission failures as safe Arabic action errors', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const { saveServiceProvider } = await import('./service-provider-service');

    await expect(saveServiceProvider('provider-1', { ...emptyServiceProviderFormValues, name: 'مزود' }))
      .rejects.toThrow(/الصلاحية المطلوبة/);
  });

  it('archives through the server-controlled RPC and requires confirmation in the response', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { provider_id: 'provider-1', archived: true }, error: null });
    const { archiveServiceProvider } = await import('./service-provider-service');

    await archiveServiceProvider('provider-1');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('archive_service_provider_atomic', { p_provider_id: 'provider-1' });
  });
});
