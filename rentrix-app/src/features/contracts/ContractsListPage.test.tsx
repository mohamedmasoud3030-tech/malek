// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractsListPage } from './ContractsListPage';
import { formatContractDate } from './contractDisplayFormatters';
import { normalizeSearchText } from './hooks/useContractFilters';
import type { ContractListItem } from './services/contractService';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';
import { testCompanySettingsContract } from '@/test/companySettingsContractMock';

// Locale-exact period labels so the test does not depend on digit systems.
const startDateLabel = formatContractDate(testCompanySettingsContract, '2026-01-01');
const endDateLabel = formatContractDate(testCompanySettingsContract, '2026-12-31');

// The page registers permission-gated actions through the shared auth seam.
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('../settings/useCompanySettings', async () => {
  const { testCompanySettingsContract } = await import('../../test/companySettingsContractMock');

  return {
    useCompanySettings: () => ({ data: testCompanySettingsContract }),
    useCompanySettingsContract: () => testCompanySettingsContract,
  };
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
  ...contractRowFixtureDefaults,
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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('ContractsListPage load states', () => {
  beforeEach(() => {
    setViewportWidth(1280);
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

  it('renders the shared desktop table and mobile card register', () => {
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('aria-label="جدول العقود"');
    expect(html).toContain('data-compact-responsive-table="true"');
    expect(html).toContain('data-entity-table-scroll');
    expect(html).toContain('<table');
    // The shared Cards ⇄ Table foundation exposes one toggle (default: Table on desktop).
    expect(html).toContain('طريقة عرض جدول العقود');
    expect(html).toContain('أحمد سالم');
    expect(html).toContain('A-101');
  });

  it('shows tenant, unit, period and rent on the contract mobile card with flat actions', () => {
    setViewportWidth(375);
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };

    const html = renderToStaticMarkup(<ContractsListPage />);
    const host = document.createElement('div');
    host.innerHTML = html;

    const card = host.querySelector<HTMLElement>('[data-entity-table-mobile-card]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('نشط');
    expect(card?.textContent).toContain('أحمد سالم');

    const summary = card?.querySelector<HTMLElement>('[data-entity-table-mobile-summary]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('الوحدة');
    expect(summary?.textContent).toContain('A-101');
    expect(summary?.textContent).toContain('الفترة');
    expect(summary?.textContent).toContain(startDateLabel);
    expect(summary?.textContent).toContain(endDateLabel);
    expect(summary?.textContent).toContain('قيمة الإيجار');

    expect(host.querySelector('[data-entity-table-mobile-actions]')).toBeNull();
    const columnsControl = host.querySelector<HTMLElement>('[data-contract-columns-control]');
    expect(columnsControl?.className).toContain('hidden');
    expect(columnsControl?.className).toContain('md:flex');
    expect(card?.textContent).toContain('عرض العقد');
    expect(card?.textContent).toContain('تعديل');
    expect(card?.querySelector('[data-action-menu]')).toBeTruthy();
  });

  it('shows the server-exact totals instead of the loaded page size', () => {
    // One page wired (1 row) while the server reports 342 matching contracts:
    // header and the «إجمالي العقود» KPI must show 342, not 1.
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 342 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('عدد السجلات 342');
    // Register metric strip (#1542): the total KPI is labelled «العقود».
    expect(html).toContain('العقود');
    expect(html).toContain('>342<');
  });

  it('renders one unified PageHeader plus semantic summary and register sections', () => {
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('data-page-header');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('عدد السجلات 1');
    expect(html).toContain('data-filter-bar');
    expect(html).toContain('data-contract-summary');
    expect(html).toContain('data-contract-register');
    expect(html).toContain('<h2');
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
