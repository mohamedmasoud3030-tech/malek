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

  it('loads provider maintenance counts without relying on a PostgREST FK relation that is not present', async () => {
    const provider = {
      id: 'provider-1',
      company_id: 'company-1',
      name: 'مزود',
      legal_name: null,
      registration_number: null,
      tax_number: null,
      contact_name: null,
      phone: null,
      alternate_phone: null,
      email: null,
      website: null,
      address: null,
      service_area: null,
      availability_notes: null,
      notes: null,
      is_active: true,
      created_at: '2026-09-19T00:00:00Z',
      updated_at: '2026-09-19T00:00:00Z',
      deleted_at: null,
      service_provider_category_links: [],
    };

    const makeQuery = (result: unknown) => {
      const query: any = {
        is: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        order: vi.fn(() => query),
        range: vi.fn().mockResolvedValue(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    };

    supabaseMock.from.mockImplementation((table: string) => table === 'service_providers'
      ? makeQuery({ data: [provider], count: 1, error: null })
      : makeQuery({ data: [
        { id: 'job-1', service_provider_id: 'provider-1', status: 'open' },
        { id: 'job-2', service_provider_id: 'provider-1', status: 'completed' },
      ], error: null }));

    const { listServiceProviders } = await import('./service-provider-service');
    const result = await listServiceProviders({ search: '', status: 'all', categoryId: '', page: 1, pageSize: 10 });

    expect(result.rows[0]).toMatchObject({ maintenance_jobs_count: 2, open_jobs_count: 1 });
    expect(supabaseMock.from).toHaveBeenCalledWith('maintenance_records');
    const providerSelect = supabaseMock.from.mock.results[0].value.select.mock.calls[0][0] as string;
    expect(providerSelect).not.toContain('maintenance_records(id,status)');
  });
});
