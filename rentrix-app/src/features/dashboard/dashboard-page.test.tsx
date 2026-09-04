// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './dashboard-page';
import { getDashboardSnapshot } from './dashboard-snapshot';

const { navigateMock, cashflowCalls, maintenanceFixtures } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  cashflowCalls: [] as Array<{ dateFrom: string; dateTo: string }>,
  maintenanceFixtures: [{
    id: 'mnt-open-urgent', property_id: 'property-2', unit_id: 'unit-5', title: 'تسرب مياه',
    priority: 'urgent', status: 'open', request_date: '2026-06-18', created_at: '2026-06-18T00:00:00Z',
  }],
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, ...rest }: any) => <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/dashboard', search: {}, hash: '', state: {}, href: '/dashboard' }),
  };
});

let mockRole: 'ADMIN' | 'MANAGER' | 'USER' = 'USER';
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: { userId: 'user-1', email: 'user@example.com', role: mockRole },
    canAccess: () => mockRole !== 'USER',
  }),
}));
vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettingsContract: () => ({ locale: 'ar-OM', currency: 'OMR', currencyDecimals: 3, dateFormat: 'YYYY-MM-DD' }),
}));
vi.mock('./dashboard-snapshot', () => ({ getDashboardSnapshot: vi.fn() }));
vi.mock('@/features/financials/reports/useFinancialReports', () => ({
  useFinancialCashflowReport: (filters: { dateFrom: string; dateTo: string }) => {
    cashflowCalls.push(filters);
    return {
      data: { rows: [{ month: '2026-06', revenue: 120, expenses: 30 }] },
      isLoading: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue(undefined),
    };
  },
}));
vi.mock('@/features/units/use-units', () => ({
  useAllUnits: () => ({
    data: [
      { id: 'unit-1', property_id: 'property-1', unit_number: '1', status: 'occupied', created_at: '2025-01-01T00:00:00Z', rent_amount: 120 },
      { id: 'unit-5', property_id: 'property-2', unit_number: '5', status: 'available', created_at: '2026-06-01T00:00:00Z', rent_amount: 150 },
    ],
    isLoading: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('@/features/contracts/useContracts', () => ({
  useAllContracts: () => ({ data: { rows: [], truncated: false }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/features/utilities/use-utilities', () => ({
  useUtilityBills: () => ({ data: [], isLoading: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/features/maintenance/use-maintenance', () => ({
  useMaintenance: () => ({ data: maintenanceFixtures, isLoading: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/features/properties/property-service', () => ({
  listPropertyTitles: vi.fn().mockResolvedValue([{ id: 'property-1', title: 'برج الياسمين' }, { id: 'property-2', title: 'برج الخليج' }]),
}));
vi.mock('@/features/onboarding/OnboardingChecklist', () => ({
  OnboardingChecklist: () => <div data-onboarding-checklist>مسار الإعداد الأول</div>,
}));

const mockSnapshot = {
  period: { dateFrom: '2026-06-01', dateTo: '2026-06-28', asOf: '2026-06-28', month: 6, year: 2026 },
  portfolio: { properties: 2, units: 2 },
  occupancy: { occupiedUnits: 1, vacantUnits: 1, occupancyRate: 50 },
  contracts: { active: 1, expiring30: 1, expiring60: 1, expiring90: 1 },
  billing: { invoicedAmount: 15000, invoicesCount: 10, invoicesTotalCount: 42 },
  collections: { collectedAmount: 12000, paymentsCount: 8, outstandingAmount: 3000, collectionRate: 80 },
  expenses: { totalAmount: 1500, count: 3 },
  netCash: 10500,
  arrears: {
    totalOverdue: 3000, overdueCount: 2, averageDaysOverdue: 18, over90Amount: 0, over90Count: 0, totalOutstanding: 3000,
    buckets: {
      current: { total: 0, count: 0 }, days_1_30: { total: 1500, count: 1 }, days_31_60: { total: 1500, count: 1 },
      days_61_90: { total: 0, count: 0 }, days_90_plus: { total: 0, count: 0 },
    },
  },
  ownerFunds: { netPayable: 25.5, settlementsDraft: 1, settlementsApproved: 1 },
  maintenance: { open: 1, inProgress: 0, urgentOpen: 1 },
  exceptions: { unmatchedBankLines: 2, pendingSettlements: 1 },
  queues: {
    expiringContracts: [{ id: 'contract-1', reference: 'CON-1', endDate: '2026-07-08', daysRemaining: 10, tenantName: 'سالم الكعبي', propertyTitle: 'برج الياسمين', unitNumber: '1' }],
    overdueInvoices: [{ invoiceId: 'invoice-1', reference: 'INV-1', dueDate: '2026-06-10', daysOverdue: 18, remainingAmount: 1500, tenantName: 'أحمد الفارسي', propertyTitle: 'برج الخليج', unitNumber: '5' }],
    urgentMaintenance: [{ id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent', propertyTitle: 'برج الخليج', unitNumber: '5' }],
  },
};

describe('Dashboard compact command center', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    cashflowCalls.length = 0;
    mockRole = 'USER';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    document.body.removeChild(container);
  });

  async function renderPage() {
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }

  it('renders only the five canonical decision surfaces', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(Array.from(container.querySelectorAll('[data-dashboard-section]')).map((node) => node.getAttribute('data-dashboard-section'))).toEqual([
      'needs-attention', 'office-pulse', 'collections', 'occupancy', 'financial-performance',
    ]);
  });

  it('proves the removed duplicate dashboard surfaces stay absent', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    for (const id of ['maintenance', 'upcoming-contracts', 'property-health', 'owner-obligations', 'finance-exceptions']) {
      expect(container.querySelector(`[data-dashboard-section="${id}"]`)).toBeNull();
    }
  });

  it('keeps maintenance, settlement and bank exceptions in the unified attention queue', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container.querySelector('[data-dashboard-section="needs-attention"]');
    expect(section?.textContent).toContain('حركة بنكية غير مطابقة');
    expect(section?.textContent).toContain('تسوية ملاك');
    expect(Array.from(section?.querySelectorAll('[data-needs-attention-link]') ?? []).some((link) => link.getAttribute('href') === '/maintenance')).toBe(true);
  });

  it('keeps core operational and financial truth visible', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(container.querySelector('[data-dashboard-office-pulse]')?.querySelectorAll('[data-kpi-card]')).toHaveLength(4);
    expect(container.querySelector('[data-dashboard-section="collections"]')?.textContent).toContain('أعمار المتأخرات');
    expect(container.querySelector('[data-dashboard-section="occupancy"]')?.textContent).toContain('برج الخليج');
    expect(container.querySelector('[data-dashboard-section="financial-performance"]')?.querySelector('[data-dashboard-performance-summary]')).not.toBeNull();
  });

  it('keeps setup shortcuts permission-gated', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(container.querySelector('[data-dashboard-onboarding-slot]')).toBeNull();
  });

  it('fails closed when the authoritative snapshot fails', async () => {
    (getDashboardSnapshot as any).mockRejectedValue(new Error('network down'));
    await renderPage();
    expect(container.textContent).toContain('تعذر تحميل بيانات اليوم');
    expect(container.querySelector('[data-dashboard-office-pulse]')).toBeNull();
  });
});
