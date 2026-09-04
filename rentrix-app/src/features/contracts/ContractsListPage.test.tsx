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

/**
 * The register reads invoice context through the canonical batched query hook.
 * Mocking at that seam (not at the domain hook) keeps the real attention
 * derivation under test while avoiding a QueryClient provider in a static render.
 */
const contractInvoiceMocks = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    reference: string | null;
    contract_id: string;
    status: string;
    amount: number;
    paid_amount: number;
    due_date: string;
  }>,
  isError: false,
}));

vi.mock('@/features/financials/invoices/useInvoices', () => ({
  useDossierInvoicesForContracts: (contractIds: readonly string[]) => ({
    // Mirrors `enabled: contractIds.length > 0`: no ids means no read at all.
    data: contractIds.length === 0 ? undefined : contractInvoiceMocks.rows,
    error: contractInvoiceMocks.isError ? new Error('تعذر تحميل الفواتير') : null,
    isError: contractInvoiceMocks.isError,
    isPending: false,
    isLoading: false,
  }),
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
    contractInvoiceMocks.rows = [];
    contractInvoiceMocks.isError = false;
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
    expect(html).toContain('طريقة عرض العقود');
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
    // Operational hierarchy: attention leads the primary quick facts, and rent
    // moves to the compact secondary line rather than adding a fourth row.
    expect(summary?.textContent).toContain('المتابعة');
    const secondaryMeta = card?.querySelector<HTMLElement>('[data-entity-table-mobile-secondary-meta]');
    expect(secondaryMeta?.textContent).toContain('قيمة الإيجار');
    expect(secondaryMeta?.textContent).toContain('الإجراء التالي');

    expect(host.querySelector('[data-entity-table-mobile-actions]')).toBeNull();
    const columnsControl = host.querySelector<HTMLElement>('[data-contract-columns-control]');
    expect(columnsControl?.className).toContain('hidden');
    expect(columnsControl?.className).toContain('md:flex');
    expect(card?.textContent).toContain('معاينة سريعة');
    expect(card?.textContent).toContain('فتح العقد بالكامل');
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
    // Round 1 removes the audited duplicate-heading defect: the register no
    // longer re-declares «التأجير»/«سجل العقود» as a competing visual authority.
    expect(html).not.toContain('>التأجير<');
    expect(html).not.toContain('>سجل العقود<');
  });
  it('surfaces payment attention through the canonical column and mobile metadata', () => {
    setViewportWidth(375);
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };
    contractInvoiceMocks.rows = [
      {
        id: 'invoice-1',
        reference: 'INV-1',
        contract_id: contractFixture.id,
        status: 'UNPAID',
        amount: 1250,
        paid_amount: 0,
        due_date: '2020-01-01',
      },
    ];

    const html = renderToStaticMarkup(<ContractsListPage />);
    const host = document.createElement('div');
    host.innerHTML = html;

    // The register attention banner names the problem and the exposure.
    const banner = host.querySelector<HTMLElement>('[data-register-attention]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('عقود تحتاج متابعة');
    expect(banner?.textContent).toContain('مستحقات غير مسددة');

    // The card carries the attention datum through EntityTable configuration,
    // never through a page-local card component.
    const card = host.querySelector<HTMLElement>('[data-entity-table-mobile-card]');
    const summary = card?.querySelector<HTMLElement>('[data-entity-table-mobile-summary]');
    expect(summary?.textContent).toContain('المتابعة');
    expect(summary?.textContent).toContain('فواتير متأخرة');
    // Rent moves to the compact secondary line instead of adding a row.
    const secondary = card?.querySelector<HTMLElement>('[data-entity-table-mobile-secondary-meta]');
    expect(secondary?.textContent).toContain('قيمة الإيجار');
    expect(secondary?.textContent).toContain('الإجراء التالي');
  });

  it('reports the canonical lifecycle next action on the register', () => {
    const draftContract: ContractListItem = { ...contractFixture, id: 'contract-draft', status: 'draft', approval_status: null };
    contractsMocks.contractsQuery.data = { rows: [draftContract], count: 1 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('الإجراء التالي');
    expect(html).toContain('إرسال للاعتماد');
    // Nothing is owed, so no payment noise is invented for a clean contract.
    expect(html).not.toContain('فواتير متأخرة');
  });

  it('distinguishes a verified clean contract from unverified payment context', () => {
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };
    contractInvoiceMocks.isError = true;

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).toContain('جارٍ التحقق من المدفوعات…');
    expect(html).not.toContain('لا يحتاج متابعة');
  });

  it('stays quiet when nothing needs attention', () => {
    contractsMocks.contractsQuery.data = { rows: [contractFixture], count: 1 };

    const html = renderToStaticMarkup(<ContractsListPage />);

    expect(html).not.toContain('data-register-attention');
    expect(html).toContain('لا يحتاج متابعة');
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
