import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceProvidersPage } from './service-providers-page';

const mocks = vi.hoisted(() => ({
  canWrite: true,
  providers: {
    data: {
      rows: [{
        id: 'provider-1', company_id: 'company-1', name: 'شركة التبريد', legal_name: null,
        registration_number: '12345', tax_number: null, contact_name: 'أحمد', phone: '90000000',
        alternate_phone: null, email: 'ops@example.test', website: null, address: 'مسقط',
        service_area: 'مسقط', availability_notes: 'متاح خلال ساعات العمل', notes: null,
        is_active: true, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z', deleted_at: null,
        categories: [{ id: 'category-1', company_id: 'company-1', name: 'تكييف', description: null, is_active: true, created_at: '', updated_at: '', deleted_at: null }],
        maintenance_jobs_count: 4, open_jobs_count: 1,
      }],
      count: 1,
    },
    isLoading: false, isError: false, error: null, refetch: vi.fn(),
  },
  categories: { data: [{ id: 'category-1', name: 'تكييف' }], isLoading: false, isError: false, error: null, refetch: vi.fn() },
  summary: { data: { total: 1, active: 1, categories: 1, openJobs: 1 }, isError: false, refetch: vi.fn() },
  mutation: { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));
vi.mock('@/app/router/background-location', () => ({ useDialogNavigate: () => vi.fn() }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ canAccess: (permission: string) => permission === 'service_providers.write' ? mocks.canWrite : true }) }));
vi.mock('./use-service-providers', () => ({
  useServiceProviders: () => mocks.providers,
  useServiceProviderSummary: () => mocks.summary,
  useServiceProviderCategories: () => mocks.categories,
  useArchiveServiceProvider: () => mocks.mutation,
  useCreateServiceProviderCategory: () => mocks.mutation,
  useUpdateServiceProviderCategory: () => mocks.mutation,
  useArchiveServiceProviderCategory: () => mocks.mutation,
}));

describe('Service Providers register', () => {
  beforeEach(() => { mocks.canWrite = true; });

  it('renders real provider, category, contact, status, and Maintenance counts in Arabic RTL', () => {
    const html = renderToStaticMarkup(<ServiceProvidersPage />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('شركة التبريد');
    expect(html).toContain('تكييف');
    expect(html).toContain('90000000');
    expect(html).toContain('نشط');
    expect(html).toContain('1 جارية');
  });

  it('exposes create, category management, edit, and archive only with the canonical write permission', () => {
    const writable = renderToStaticMarkup(<ServiceProvidersPage />);
    expect(writable).toContain('إضافة مزود');
    expect(writable).toContain('إدارة أنواع الخدمات');
    expect(writable).toContain('تعديل');
    expect(writable).toContain('أرشفة');

    mocks.canWrite = false;
    const readOnly = renderToStaticMarkup(<ServiceProvidersPage />);
    expect(readOnly).not.toContain('إضافة مزود');
    expect(readOnly).not.toContain('إدارة أنواع الخدمات');
    expect(readOnly).not.toContain('>تعديل<');
    expect(readOnly).not.toContain('>أرشفة<');
    expect(readOnly).toContain('>عرض<');
  });

  it('renders a retryable register error instead of an empty success state', () => {
    const previous = { ...mocks.providers };
    Object.assign(mocks.providers, { data: undefined, isError: true, error: new Error('provider read failed') });
    try {
      const html = renderToStaticMarkup(<ServiceProvidersPage />);
      expect(html).toContain('تعذر تحميل مزودي الخدمات');
      expect(html).toContain('إعادة المحاولة');
    } finally {
      Object.assign(mocks.providers, previous);
    }
  });
});
