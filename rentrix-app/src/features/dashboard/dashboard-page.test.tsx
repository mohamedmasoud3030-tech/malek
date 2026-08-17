// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './dashboard-page';
import { getDashboardSnapshot } from './dashboard-snapshot';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, ...rest }: any) => (
      <a href={typeof to === 'string' ? to : '#'} {...rest}>
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/dashboard', search: {}, hash: '', state: {}, href: '/dashboard' }),
  };
});

let mockRole: 'ADMIN' | 'MANAGER' | 'USER' = 'USER';
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => {
    const role = mockRole;
    const permissions: Record<string, string[]> = {
      ADMIN: ['properties.write', 'contracts.write', 'financial.payments.create', 'maintenance.view'],
      MANAGER: ['properties.write', 'contracts.write', 'financial.payments.create', 'maintenance.view'],
      USER: [],
    };
    return {
      authorization: { userId: 'user-1', email: 'user@example.com', role },
      canAccess: (permission: string) => permissions[role].includes(permission),
    };
  },
}));

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettingsContract: () => ({ locale: 'ar-OM', currency: 'OMR', currencyDecimals: 3, dateFormat: 'YYYY-MM-DD' }),
}));

vi.mock('./dashboard-snapshot', () => ({ getDashboardSnapshot: vi.fn() }));
vi.mock('@/services/action-center-counts', () => ({ fetchIntegrityWarningsCount: vi.fn().mockResolvedValue(0) }));
vi.mock('@/features/onboarding/OnboardingChecklist', () => ({
  OnboardingChecklist: () => <div data-onboarding-checklist>مسار الإعداد الأول</div>,
}));

const mockSnapshot = {
  period: { dateFrom: '2026-06-01', dateTo: '2026-06-28', asOf: '2026-06-28', month: 6, year: 2026 },
  portfolio: { properties: 4, units: 15 },
  occupancy: { occupiedUnits: 12, vacantUnits: 3, occupancyRate: 80 },
  contracts: { active: 8, expiring30: 2, expiring60: 3, expiring90: 4 },
  billing: { invoicedAmount: 15000, invoicesCount: 10, invoicesTotalCount: 42 },
  collections: { collectedAmount: 12000, paymentsCount: 8, outstandingAmount: 3000, collectionRate: 80 },
  expenses: { totalAmount: 1500, count: 3 },
  netCash: 10500,
  arrears: {
    totalOverdue: 3000, overdueCount: 2, averageDaysOverdue: 18, over90Amount: 0, over90Count: 0, totalOutstanding: 3000,
    buckets: {
      current: { total: 0, count: 0 },
      days_1_30: { total: 1500, count: 1 },
      days_31_60: { total: 1500, count: 1 },
      days_61_90: { total: 0, count: 0 },
      days_90_plus: { total: 0, count: 0 },
    },
  },
  ownerFunds: { netPayable: 0, settlementsDraft: 0, settlementsApproved: 0 },
  maintenance: { open: 2, inProgress: 1, urgentOpen: 1 },
  exceptions: { unmatchedBankLines: 0, pendingSettlements: 0 },
  queues: {
    expiringContracts: [{
      id: 'contract-1', reference: 'CON-1',
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      daysRemaining: 10, tenantName: 'سالم الكعبي', propertyTitle: 'برج الياسمين', unitNumber: '101',
    }],
    overdueInvoices: [{
      invoiceId: 'invoice-1', reference: 'INV-1', dueDate: '2026-06-10', daysOverdue: 18,
      remainingAmount: 1500, tenantName: 'أحمد الفارسي', propertyTitle: 'برج الخليج', unitNumber: '5',
    }],
    urgentMaintenance: [{ id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent', propertyTitle: 'برج الخليج', unitNumber: '5' }],
  },
};

describe('Today workspace query boundary tests', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'USER';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    if (container) {
      act(() => { root.unmount(); });
      document.body.removeChild(container);
      container = null;
    }
  });

  async function renderPage() {
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }

  it('renders Today as an action-first workspace from the authoritative snapshot', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(getDashboardSnapshot).toHaveBeenCalled();
    const text = container?.textContent ?? '';
    expect(text).toContain('اليوم');
    expect(text).toContain('مطلوب منك الآن');
    expect(text).toContain('وضع المكتب');
    expect(text).toContain('نسبة الإشغال');
    expect(text).toContain('العقود المنتهية قريباً');
    expect(text).toContain('سالم الكعبي');
    expect(text).toContain('أعلى المتأخرات');
    expect(text).toContain('أحمد الفارسي');
    expect(text).toContain('الأولوية الآن');
    expect(text).toContain('حالة التحصيل');
  });

  it('scopes Visual Contract V2 on a real Today-owned wrapper', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const scope = container?.querySelector('[data-visual-contract="v2"]');
    expect(scope).not.toBeNull();
    expect(scope?.querySelector('[data-dashboard-hero]')).not.toBeNull();
    expect(scope?.querySelectorAll('[data-dashboard-section]').length).toBeGreaterThanOrEqual(3);
    expect(container?.querySelector('[data-page-layout][data-visual-contract]')).toBeNull();
  });

  it('orders work first, office state second, analysis last', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const sectionOrder = Array.from(container?.querySelectorAll('[data-dashboard-section]') ?? [])
      .map((section) => section.getAttribute('data-dashboard-section'));
    expect(sectionOrder).toEqual(['work-now', 'office-state', 'analytics']);
  });

  it('renders KPI surfaces as real destination links', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const kpiLinks = Array.from(container?.querySelectorAll('[data-dashboard-kpi-grid] a[data-dashboard-kpi-link]') ?? []);
    expect(kpiLinks).toHaveLength(4);
    expect(kpiLinks.map((link) => link.getAttribute('href'))).toEqual(['/financials', '/arrears', '/reports', '/expenses']);
  });

  it('hides create shortcuts for roles with no actionable permission', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    mockRole = 'USER';
    await renderPage();
    expect(container?.querySelectorAll('[data-dashboard-action-grid] > *')).toHaveLength(0);
    expect(container?.querySelector('[data-dashboard-section="actions"]')).toBeNull();
  });

  it('shows permitted create shortcuts after existing work for a manager', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    mockRole = 'MANAGER';
    await renderPage();
    const text = container?.textContent ?? '';
    expect(text).toContain('ابدأ إجراء');
    expect(text).toContain('إنشاء عقد');
    expect(container?.querySelectorAll('[data-dashboard-action-grid] > *')).toHaveLength(4);
    const onboardingSlot = container?.querySelector('[data-dashboard-onboarding-slot]');
    const workNow = container?.querySelector('[data-dashboard-section="work-now"]');
    expect(onboardingSlot).not.toBeNull();
    expect(workNow).not.toBeNull();
    if (!onboardingSlot || !workNow) throw new Error('Dashboard setup/work slots are required');
    expect(onboardingSlot.compareDocumentPosition(workNow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const sectionOrder = Array.from(container?.querySelectorAll('[data-dashboard-section]') ?? [])
      .map((section) => section.getAttribute('data-dashboard-section'));
    expect(sectionOrder).toEqual(['work-now', 'actions', 'office-state', 'analytics']);
  });

  it('handles query loading state without fabricating current work', async () => {
    (getDashboardSnapshot as any).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
    });
    expect(container?.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(0);
  });

  it('stays honest on failure: no fake zero KPIs replace the failed snapshot', async () => {
    (getDashboardSnapshot as any).mockRejectedValue(new Error('network down'));
    await renderPage();
    const text = container?.textContent ?? '';
    expect(text).toContain('تعذر تحميل بيانات اليوم');
    expect(container?.querySelector('[data-dashboard-kpi-grid]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="office-state"]')).toBeNull();
  });
});
