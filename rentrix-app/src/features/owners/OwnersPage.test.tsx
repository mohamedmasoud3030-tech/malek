import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OwnerDetailView } from './components/owner-detail-view';
import type { Owner, OwnerDetailSnapshot, PropertyWithOwners } from './services/owner-service';
import type { OwnerSettlementRecord } from './services/owner-settlements-service';
import { ownerRowFixtureDefaults, propertyOwnerRowFixtureDefaults, propertyRowFixtureDefaults } from '@/test/ownerRowFixture';

vi.mock('../settings/useCompanySettings', async () => {
  const { testCompanySettingsContract } = await import('../../test/companySettingsContractMock');

  return { useCompanySettingsContract: () => testCompanySettingsContract };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: Readonly<{ children: React.ReactNode; to: string }>) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/owners', search: {}, hash: '', state: undefined }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: null, canAccess: () => false }),
  useOptionalAuth: () => null,
}));

vi.mock('@/app/router/background-location', () => ({
  useDialogNavigate: () => vi.fn(),
}));

const owner: Owner = {
  ...ownerRowFixtureDefaults,
  id: 'owner-1',
  full_name: 'مالك موثق',
  display_name: null,
  phone: '90000000',
  email: null,
  national_id: null,
  tax_number: null,
  address: null,
  notes: null,
  is_active: true,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
};

const property: PropertyWithOwners = {
  ...propertyRowFixtureDefaults,
  id: 'property-1',
  title: 'عقار موثق',
  type: 'سكني',
  address: 'مسقط',
  owner_name: null,
  purchase_value: null,
  current_value: null,
  status: 'active',
  notes: null,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
  deleted_at: null,
  property_owners: [{
    ...propertyOwnerRowFixtureDefaults,
    id: 'link-1',
    property_id: 'property-1',
    owner_id: 'owner-1',
    ownership_percentage: 100,
    is_primary: true,
    starts_on: null,
    ends_on: null,
    created_at: '2026-06-04T00:00:00.000Z',
    updated_at: '2026-06-04T00:00:00.000Z',
    owner,
  }],
};

function renderOwnerDetail(
  props: Readonly<{
    state: Parameters<typeof OwnerDetailView>[0]['state'];
    settlements?: Parameters<typeof OwnerDetailView>[0]['settlements'];
    canOpenOwnerSettlements?: boolean;
  }>,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <OwnerDetailView state={props.state} settlements={props.settlements} canOpenOwnerSettlements={props.canOpenOwnerSettlements} />
    </QueryClientProvider>,
  );
}

describe('Owner detail recovery states', () => {
  it('renders the owner detail loading state', () => {
    expect(renderToStaticMarkup(<OwnerDetailView state={{ status: 'loading' }} />)).toContain('aria-label="جارٍ التحميل');
  });

  it('renders the owner detail surface', () => {
    const snapshot: OwnerDetailSnapshot = {
      owner,
      properties: [property],
      units: [{ id: 'unit-1', property_id: property.id, unit_number: '101', floor: null, status: 'occupied', rent_amount: 100 }],
      contracts: [
        { id: 'contract-1', reference: 'CNT-1', property_id: property.id, unit_id: 'unit-1', start_date: '2026-01-01', end_date: '2026-12-31', status: 'active' },
        { id: 'contract-2', reference: 'CNT-2', property_id: property.id, unit_id: 'unit-1', start_date: '2025-01-01', end_date: '2025-12-31', status: 'expired' },
      ],
      invoices: [
        {
          id: 'invoice-1',
          reference: 'INV-1',
          contract_id: 'contract-1',
          amount: 1000,
          paid_amount: 250,
          status: 'partial',
          deleted_at: null,
          due_date: '2026-02-01',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      financialSummary: { outstandingBalance: 750, outstandingInvoicesCount: 1 },
    };
    const html = renderOwnerDetail({ state: { status: 'ready', snapshot } });

    expect(html).toContain('مالك موثق');
    expect(html).toContain('العقارات المرتبطة');
    expect(html).toContain('العقود النشطة');
    expect(html).toContain('مستحقات المستأجرين');
    expect(html).toContain('OMR');
    expect(html).toContain('750');
    expect(html).toContain('/owners');
    expect(html).not.toContain('/owners-hub');
  });

  it('renders the owner settlements section when settlements are provided', () => {
    const snapshot: OwnerDetailSnapshot = {
      owner,
      properties: [property],
      units: [],
      contracts: [],
      invoices: [],
      financialSummary: { outstandingBalance: 0, outstandingInvoicesCount: 0 },
    };
    const settlement: OwnerSettlementRecord = {
      id: 'settlement-1',
      owner_id: owner.id,
      owner_name: owner.full_name,
      property_id: property.id,
      property_title: property.title,
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      gross_rent_collected: 1200,
      management_fee_amount: 60,
      owner_expenses: 40,
      fee_vat_amount: 0,
      net_payable_amount: 1100,
      status: 'pending',
      created_at: '2026-07-20T00:00:00.000Z',
    };
    const html = renderOwnerDetail({ state: { status: 'ready', snapshot }, settlements: [settlement], canOpenOwnerSettlements: true });

    expect(html).toContain('تسويات المالك');
    expect(html).toContain('مسودة بانتظار الاعتماد');
    expect(html).toContain('الموقف المالي للمالك');
    expect(html).not.toContain('/owner-settlements');
    expect(html).toContain('عقار موثق');
  });

  it('hides the settlements section when settlements are not provided', () => {
    const snapshot: OwnerDetailSnapshot = {
      owner,
      properties: [property],
      units: [],
      contracts: [],
      invoices: [],
      financialSummary: { outstandingBalance: 0, outstandingInvoicesCount: 0 },
    };
    const html = renderOwnerDetail({ state: { status: 'ready', snapshot } });

    // The settlements section (with its dedicated description) must be absent
    // when no settlement data is provided.
    expect(html).not.toContain('أحدث التسويات المعدة لهذا المالك');
    expect(html).not.toContain('مسودة بانتظار الاعتماد');
  });

  it('renders the owner detail unavailable state', () => {
    expect(renderToStaticMarkup(<OwnerDetailView state={{ status: 'unavailable', reason: 'schema unavailable' }} />)).toContain('schema unavailable');
  });
});
