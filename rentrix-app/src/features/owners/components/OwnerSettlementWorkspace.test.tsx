import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OwnerSettlementWorkspace } from './OwnerSettlementWorkspace';
import * as settlementsService from '../services/owner-settlements-service';

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    if (opts.queryKey?[0] === 'owner-settlements') {
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
            management_fee_rate: 10,
            management_fee_type: 'percentage',
            management_fee_amount: 150,
            maintenance_deductions: 50,
            utility_deductions: 0,
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
    if (opts.queryKey?[0] === 'owner-settlement-targets') {
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
    if (opts.queryKey?[0] === 'owner-settlement-preview') {
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
    settings: { companyName: 'Rentrix' },
  }),
}));

describe('OwnerSettlementWorkspace full coverage tests', () => {
  it('renders workspace with KPI cards and settlement rows', () => {
    const html = renderToStaticMarkup(<OwnerSettlementWorkspace />);
    expect(html).toContain('تسويات الملاك');
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
        management_fee_rate: 10,
        management_fee_type: 'percentage',
        management_fee_amount: 200,
        maintenance_deductions: 100,
        utility_deductions: 0,
        net_payable_amount: 1700,
        status: 'pending',
        created_at: '2026-07-01T00:00:00Z',
      },
    ]);
    expect(totals.gross).toBe(2000);
    expect(totals.fees).toBe(200);
    expect(totals.deductions).toBe(100);
    expect(totals.net).toBe(1700);
  });
});
