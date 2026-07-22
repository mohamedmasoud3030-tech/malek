import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractsListPage } from './ContractsListPage';
import { normalizeSearchText } from './hooks/useContractFilters';
import type { ContractListItem } from './services/contractService';

vi.mock('../settings/useCompanySettings', async () => {
  const { testCompanySettingsContract } = await import('../../test/companySettingsContractMock');

  return { useCompanySettingsContract: () => testCompanySettingsContract };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to }: Readonly<{ children: React.ReactNode; params?: { contractId?: string }; to: string }>) => {
    const href = params?.contractId ? `/contracts/${params.contractId}` : to;
    return <a href={href}>{children}</a>;
  },
  useNavigate: () => vi.fn(),
}));

vi.mock('./contract-form-modal', () => ({
  ContractFormModal: () => null,
}));

const contractsMocks = vi.hoisted(() => ({
  contractsQuery: { data: { rows: [] as unknown[], count: 0 }, error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  deleteMutation: { isPending: false, mutate: vi.fn() },
}));

const contractFixture: ContractListItem = {
  id: 'contract-123456789',
  property_id: 'property-1',
  unit_id: 'unit-1',
  tenant_id: 'tenant-1',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  rent_amount: 1250,
  payment_cycle: 'monthly',
  payment_terms_id: null,
  status: 'active',
  notes: null,
  renewed_from_id: null,
  cancellation_reason: null,
  attachment_url: null,
  agreement_id: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  properties: { id: 'property-1', title: 'برج الريان', address: 'مسقط' },
  units: { id: 'unit-1', unit_number: 'A-101', floor: '1', status: 'occupied', rent_amount: 1250 },
  people: { id: 'tenant-1', full_name: 'أحمد سالم', phone: '+96890000000', email: null, national_id: 'OM123' },
};

vi.mock('./useContracts', () => ({
  useContract: () => ({ data: null, error: null, isError: false, isLoading: false }),
  useContracts: () => contractsMocks.contractsQuery,
  useCreateContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSoftDeleteContract: () => contractsMocks.deleteMutation,
}));

describe('ContractsListPage load states', () => {
  beforeEach(() => {
    contractsMocks.contractsQuery.data = { rows: [], count: 0 };
    contractsMocks.contractsQuery.error = null;
    contractsMocks.contractsQuery.isError = false;
    contractsMocks.contractsQuery.isLoading = false;
  });

  it('renders a retryable error state when contract loading fails', () => {
    contractsMocks.contractsQuery.error = new Error('تعذر تحميل عقود الاختبار');
    contractsMocks.contractsQuery.isError = true;

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('تعذر تحميل العقود');
    expect(html).toContain('إعادة المحاولة');
  });

  it('keeps the empty state available when there are no contracts', () => {
    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('لا توجد عقود');
    expect(html).toContain('إنشاء عقد');
  });

  it('renders desktop rows and mobile cards through the shared entity table', () => {
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('aria-label="جدول العقود"');
    expect(html).toContain('role="list" aria-label="جدول العقود"');
    expect(html).toContain('أحمد سالم');
    expect(html).toContain('A-101');
  });

  it('shows the server-exact totals instead of the loaded page size', () => {
    // One page wired (1 row) while the server reports 342 matching contracts:
    // header and the «إجمالي العقود» KPI must show 342, not 1.
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 342 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('عدد السجلات 342');
    expect(html).toContain('إجمالي العقود');
    expect(html).toContain('>342<');
  });

  it('renders the unified PageHeader (h1 + record count) and shared filter surface', () => {
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('data-page-header');
    expect(html).toContain('<h1');
    expect(html).toContain('عدد السجلات 1');
    expect(html).toContain('data-list-controls');
    expect(html).not.toContain('<h2');
  });
});

describe('normalizeSearchText', () => {
  it('removes diacritics', () => {
    expect(normalizeSearchText('فَاطِمَة')).toBe('فاطمه');
  });

  it('normalizes Alef variations', () => {
    expect(normalizeSearchText('إحمد')).toBe('احمد');
  });

  it('normalizes Teh Marbuta', () => {
    expect(normalizeSearchText('جميلة')).toBe('جميله');
  });

  it('converts Arabic and Persian digits', () => {
    expect(normalizeSearchText('١٢٣')).toBe('123');
    expect(normalizeSearchText('۱۲۳')).toBe('123');
  });

  it('handles mixed content and whitespace', () => {
    expect(normalizeSearchText('  أَحْمَد  ')).toBe('احمد');
    expect(normalizeSearchText('عقد   رقم')).toBe('عقد رقم');
  });
});
