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

describe('Dashboard command center query boundary tests', () => {
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

  it('renders an action-first command center from the authoritative snapshot', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(getDashboardSnapshot).toHaveBeenCalled();
    const text = container?.textContent ?? '';
    expect(text).toContain('اليوم');
    expect(text).toContain('مطلوب الآن');
    expect(text).toContain('نبض المكتب');
    expect(text).toContain('العمل المنتظر');
    expect(text).toContain('المال والالتزامات');
    expect(text).toContain('حالة التحصيل والمحفظة');
    expect(text).toContain('تحليل المتأخرات');
    expect(text).toContain('نسبة الإشغال');
    expect(text).toContain('عقود تنتهي قريباً');
    expect(text).toContain('سالم الكعبي');
    expect(text).toContain('أعلى المتأخرات');
    expect(text).toContain('أحمد الفارسي');
    expect(text).toContain('الصيانة العاجلة');
    expect(text).toContain('تسرب مياه');
    expect(text).not.toContain('الأولوية الآن');
    expect(container?.querySelector('[data-dashboard-priority-panel] h2')?.textContent).toBe('مطلوب الآن');
    expect(text).toContain('حالة التحصيل');
  });

  it('moves Day + Date into the shared compact Today context strip instead of a dashboard-owned card', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    const todayContext = container?.querySelector<HTMLElement>('[data-global-today-context]');
    expect(todayContext).not.toBeNull();
    // "اليوم" remains the page heading (visually hidden) while the shared
    // strip carries the same compact day context for every operational page.
    expect(container?.querySelector('h1')?.textContent).toBe('اليوم');
    // Localized weekday + localized date live in the strip.
    const weekday = todayContext?.querySelector<HTMLElement>('[data-global-today-weekday]');
    const dayDate = todayContext?.querySelector<HTMLElement>('[data-global-today-day-date]');
    expect(weekday?.textContent?.trim().length).toBeGreaterThan(0);
    expect(dayDate?.textContent?.trim().length).toBeGreaterThan(0);
    // The old centered header date block must not exist anywhere on the page.
    expect(container?.querySelector('[data-header-date-center]')).toBeNull();
    // No duplicate dashboard-owned Today card may come back.
    expect(container?.querySelector('[data-dashboard-today-context]')).toBeNull();
  });

  it('scopes Visual Contract V2 on a real dashboard-owned wrapper', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const scope = container?.querySelector('[data-visual-contract="v2"]');
    expect(scope).not.toBeNull();
    // The decorative hero card was removed; the strip + sections own the page.
    expect(scope?.querySelector('[data-dashboard-hero]')).toBeNull();
    expect(scope?.querySelectorAll('[data-dashboard-section]').length).toBeGreaterThanOrEqual(5);
    expect(container?.querySelector('[data-page-layout][data-visual-contract]')).toBeNull();
  });

  it('keeps an explicit refresh action wired to the snapshot query', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    const refresh = container?.querySelector<HTMLButtonElement>('[data-global-refresh]');
    expect(refresh).not.toBeNull();
    expect(refresh?.getAttribute('aria-label')).toBe('تحديث');
    // 44px hit target stays preserved inside the shared strip.
    expect(refresh?.className).toContain('size-11');
    await act(async () => refresh?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect((getDashboardSnapshot as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('orders decisions, pulse, work queues, money, operational health, then analysis', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const sectionOrder = Array.from(container?.querySelectorAll('[data-dashboard-section]') ?? [])
      .map((section) => section.getAttribute('data-dashboard-section'));
    expect(sectionOrder).toEqual(['work-now', 'office-pulse', 'work-queues', 'money-obligations', 'operational-health', 'analytics']);
    expect(container?.querySelector('[data-dashboard-section="actions"]')).toBeNull();
  });

  it('renders four stable office pulse slots without mixing them into money-obligation links', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const pulse = container?.querySelector('[data-dashboard-office-pulse]');
    expect(pulse).not.toBeNull();
    expect(pulse?.querySelectorAll('[data-kpi-card]')).toHaveLength(4);

    const kpiLinks = Array.from(container?.querySelectorAll('[data-dashboard-kpi-grid] a[data-dashboard-kpi-link]') ?? []);
    expect(kpiLinks).toHaveLength(4);
    expect(kpiLinks.map((link) => link.getAttribute('href'))).toEqual(['/reports', '/financials', '/expenses', '/owner-settlements']);
  });

  it('keeps all four money-and-obligation slots visible when expenses are zero', async () => {
    (getDashboardSnapshot as any).mockResolvedValue({
      ...mockSnapshot,
      expenses: { totalAmount: 0, count: 0 },
      netCash: mockSnapshot.collections.collectedAmount,
    });
    await renderPage();

    const moneyGrid = container?.querySelector('[data-dashboard-kpi-grid]');
    expect(moneyGrid).not.toBeNull();
    expect(moneyGrid?.querySelectorAll('a[data-dashboard-kpi-link]')).toHaveLength(4);
    expect(moneyGrid?.textContent).toContain('المصروفات');
  });

  it('surfaces all three bounded operational queues', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const queueSection = container?.querySelector('[data-dashboard-section="work-queues"]');
    expect(queueSection).not.toBeNull();
    expect(queueSection?.textContent).toContain('أعلى المتأخرات');
    expect(queueSection?.textContent).toContain('عقود تنتهي قريباً');
    expect(queueSection?.textContent).toContain('الصيانة العاجلة');
  });

  it('keeps create shortcuts out of the dashboard because the global dock already owns them', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    mockRole = 'MANAGER';
    await renderPage();
    expect(container?.querySelector('[data-dashboard-section="actions"]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-action-grid]')).toBeNull();

    const workNow = container?.querySelector('[data-dashboard-section="work-now"]');
    const onboardingSlot = container?.querySelector('[data-dashboard-onboarding-slot]');
    const pulse = container?.querySelector('[data-dashboard-section="office-pulse"]');
    expect(workNow).not.toBeNull();
    expect(onboardingSlot).not.toBeNull();
    expect(pulse).not.toBeNull();
    if (!workNow || !onboardingSlot || !pulse) throw new Error('Dashboard work/setup/pulse slots are required');
    expect(workNow.compareDocumentPosition(onboardingSlot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(onboardingSlot.compareDocumentPosition(pulse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('handles query loading state without fabricating current work', async () => {
    (getDashboardSnapshot as any).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
    });
    expect(container?.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(0);
  });

  it('stays honest on failure: no fake zero command-center surfaces replace the failed snapshot', async () => {
    (getDashboardSnapshot as any).mockRejectedValue(new Error('network down'));
    await renderPage();
    const text = container?.textContent ?? '';
    expect(text).toContain('تعذر تحميل بيانات اليوم');
    expect(container?.querySelector('[data-dashboard-office-pulse]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-kpi-grid]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="work-queues"]')).toBeNull();
  });
});
