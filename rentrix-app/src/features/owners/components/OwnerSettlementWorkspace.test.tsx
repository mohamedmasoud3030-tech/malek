import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OwnerSettlementWorkspace, SettlementSupervisionBanner } from './OwnerSettlementWorkspace';
import * as settlementsService from '../services/owner-settlements-service';

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    const key = opts && opts.queryKey && opts.queryKey.length > 0 ? opts.queryKey[0] : null;
    if (key === 'owner-settlements') {
      return {
        data: [
          {
            id: 'settlement-1',
            owner_id: 'owner-1',
            owner_name: 'أحمد المالكي',
            property_id: 'property-1',
            property_title: 'عقار الخوض',
            period_start: '2026-07-01',
            period_end: '2026-07-31',
            gross_rent_collected: 1500,
            management_fee_amount: 150,
            owner_expenses: 50,
            fee_vat_amount: 0,
            net_payable_amount: 1300,
            status: 'pending',
            created_at: '2026-07-20T00:00:00.000Z',
          },
        ],
        isLoading: false,
        isError: false,
        error: null,
      };
    }
    if (key === 'owner-settlement-targets') {
      return {
        data: [
          {
            owner_id: 'owner-1',
            owner_name: 'أحمد المالكي',
            property_id: 'property-1',
            property_title: 'عقار الخوض',
            commission_type: 'percentage',
            commission_value: 10,
          },
        ],
        isLoading: false,
        isError: false,
        error: null,
      };
    }
    if (key === 'owner-settlement-preview') {
      return {
        data: {
          gross_collected: 1500,
          office_fee: 150,
          owner_expenses: 50,
          tax_amount: 0,
          net_payable: 1300,
          breakdown: { source: 'parity', payments_count: 2 },
        },
        isLoading: false,
        isError: false,
        error: null,
      };
    }
    return { data: null, isLoading: false, isError: false, error: null };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: { role: 'admin', permissions: ['financial.owner_settlements.approve', 'financial.owner_settlements.pay'] },
  }),
}));

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => ({
    isReady: true,
    isLoading: false,
    companySettings: { companyName: 'Rentrix', currency: 'OMR', documentPrefixes: {} },
  }),
}));

describe('OwnerSettlementWorkspace full coverage tests', () => {
  it('renders workspace with KPI cards and settlement rows', () => {
    const html = renderToStaticMarkup(<OwnerSettlementWorkspace />);
    expect(html).toContain('مركز تسويات ومحاسبة الملاك');
    expect(html).toContain('إنشاء مسودة تسوية');
    expect(html).toContain('عقار الخوض');
    expect(html).toContain('أحمد المالكي');
    expect(html).toContain('مسودة بانتظار الاعتماد');
  });

  it('tests summarizeLiveOwnerSettlements helper directly', () => {
    const totals = settlementsService.summarizeLiveOwnerSettlements([
      {
        id: 's-1',
        owner_id: 'o-1',
        owner_name: 'مالك',
        property_id: 'p-1',
        property_title: 'عقار',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        gross_rent_collected: 2000,
        management_fee_amount: 200,
        owner_expenses: 100,
        fee_vat_amount: 0,
        net_payable_amount: 1700,
        status: 'pending',
        created_at: '2026-07-01T00:00:00Z',
      },
    ]);
    expect(totals.gross).toBe(2000);
    expect(totals.fees).toBe(200);
    expect(totals.expenses).toBe(100);
    expect(totals.feeVat).toBe(0);
    expect(totals.net).toBe(1700);
  });
});

describe('SettlementSupervisionBanner — first-run ADMIN supervision UX (Wave D)', () => {
  const pendingSettlement = {
    id: 's-1',
    owner_id: 'o-1',
    owner_name: 'مالك',
    property_id: 'p-1',
    property_title: 'عقار',
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    gross_rent_collected: 2000,
    management_fee_amount: 200,
    owner_expenses: 100,
    fee_vat_amount: 0,
    net_payable_amount: 1700,
    status: 'pending' as const,
    created_at: '2026-07-01T00:00:00Z',
  };

  it('tells operators without the approve permission that ADMIN approval is required', () => {
    const html = renderToStaticMarkup(
      <SettlementSupervisionBanner
        settlements={[pendingSettlement]}
        canApproveSettlement={false}
        canPaySettlement={false}
      />,
    );
    expect(html).toContain('data-settlement-supervision="needs-admin"');
    expect(html).toContain('يتطلبان صلاحية المدير/المسؤول');
  });

  it('shows the first-run supervision hint for the first payout cycle under ADMIN', () => {
    const html = renderToStaticMarkup(
      <SettlementSupervisionBanner
        settlements={[pendingSettlement]}
        canApproveSettlement
        canPaySettlement
      />,
    );
    expect(html).toContain('data-settlement-supervision="first-run"');
    expect(html).toContain('أول دورة تسويات');
  });

  it('renders nothing once a payout cycle has completed (approver view)', () => {
    const paidSettlement = { ...pendingSettlement, status: 'paid' as const, paid_at: '2026-08-01T00:00:00Z' };
    const html = renderToStaticMarkup(
      <SettlementSupervisionBanner
        settlements={[paidSettlement, pendingSettlement]}
        canApproveSettlement
        canPaySettlement
      />,
    );
    expect(html).toBe('');
  });

  it('renders nothing when there are no settlements', () => {
    const html = renderToStaticMarkup(
      <SettlementSupervisionBanner settlements={[]} canApproveSettlement canPaySettlement />,
    );
    expect(html).toBe('');
  });
});
