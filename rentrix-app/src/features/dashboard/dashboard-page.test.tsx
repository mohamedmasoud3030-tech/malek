// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './dashboard-page';
import { getDashboardSnapshot } from './dashboard-snapshot';

const { navigateMock, cashflowCalls, unitFixtures, maintenanceFixtures, daysAgo } = vi.hoisted(() => {
  const daysAgoInner = (count: number) => new Date(Date.now() - count * 24 * 60 * 60 * 1000).toISOString();
  return {
    navigateMock: vi.fn(),
    cashflowCalls: [] as Array<{ dateFrom: string; dateTo: string }>,
    unitFixtures: [
      { id: 'unit-1', property_id: 'property-1', unit_number: '1', status: 'occupied', created_at: '2025-01-01T00:00:00Z', rent_amount: 120 },
      { id: 'unit-2', property_id: 'property-1', unit_number: '2', status: 'occupied', created_at: '2025-01-01T00:00:00Z', rent_amount: 120 },
      { id: 'unit-3', property_id: 'property-1', unit_number: '3', status: 'occupied', created_at: '2025-01-01T00:00:00Z', rent_amount: 120 },
      { id: 'unit-4', property_id: 'property-2', unit_number: '4', status: 'occupied', created_at: '2025-01-01T00:00:00Z', rent_amount: 150 },
      { id: 'unit-5', property_id: 'property-2', unit_number: '5', status: 'available', created_at: '2026-06-01T00:00:00Z', rent_amount: 150 },
    ],
    maintenanceFixtures: [] as Array<Record<string, unknown>>,
    daysAgo: daysAgoInner,
  };
});

maintenanceFixtures.push(
  { id: 'mnt-open-urgent', property_id: 'property-2', unit_id: 'unit-5', title: 'تسرب مياه', priority: 'urgent', status: 'open', request_date: daysAgo(10).slice(0, 10), created_at: daysAgo(10) },
  { id: 'mnt-progress', property_id: 'property-2', unit_id: null, title: 'صبغ', priority: 'medium', status: 'in_progress', request_date: daysAgo(3).slice(0, 10), created_at: daysAgo(3) },
  { id: 'mnt-resolved', property_id: 'property-1', unit_id: null, title: 'مكيف', priority: 'medium', status: 'resolved', request_date: daysAgo(20).slice(0, 10), completed_at: daysAgo(18), created_at: daysAgo(20) },
  { id: 'mnt-closed', property_id: 'property-2', unit_id: null, title: 'باب', priority: 'low', status: 'closed', request_date: daysAgo(40).slice(0, 10), completed_at: daysAgo(35), created_at: daysAgo(40) },
);

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, ...rest }: any) => (
      <a href={typeof to === 'string' ? to : '#'} {...rest}>
        {children}
      </a>
    ),
    useNavigate: () => navigateMock,
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

vi.mock('./daily-collection-series', () => ({
  useDailyCollectionSeries: () => ({
    data: {
      rows: [
        { date: '2026-06-01', total: 400 },
        { date: '2026-06-03', total: 250 },
        { date: '2026-06-05', total: 610 },
      ],
      total: 1260,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/features/financials/reports/useFinancialReports', () => ({
  useFinancialCashflowReport: (filters: { dateFrom: string; dateTo: string }) => {
    cashflowCalls.push({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    return {
      data: {
        rows: [
          { month: '2026-05', revenue: 100, expenses: 40 },
          { month: '2026-06', revenue: 120, expenses: 30 },
        ],
        totalRevenue: 220,
        totalExpenses: 70,
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

vi.mock('@/features/units/use-units', () => ({
  useAllUnits: () => ({ data: unitFixtures, isLoading: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue(undefined) }),
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
  listPropertyTitles: vi.fn().mockResolvedValue([
    { id: 'property-1', title: 'برج الياسمين' },
    { id: 'property-2', title: 'برج الخليج' },
  ]),
}));

vi.mock('@/features/onboarding/OnboardingChecklist', () => ({
  OnboardingChecklist: () => <div data-onboarding-checklist>مسار الإعداد الأول</div>,
}));

const mockSnapshot = {
  period: { dateFrom: '2026-06-01', dateTo: '2026-06-28', asOf: '2026-06-28', month: 6, year: 2026 },
  portfolio: { properties: 2, units: 5 },
  occupancy: { occupiedUnits: 4, vacantUnits: 1, occupancyRate: 80 },
  contracts: { active: 4, expiring30: 2, expiring60: 3, expiring90: 4 },
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
  ownerFunds: { netPayable: 25.5, settlementsDraft: 1, settlementsApproved: 1 },
  maintenance: { open: 2, inProgress: 1, urgentOpen: 1 },
  exceptions: { unmatchedBankLines: 2, pendingSettlements: 1 },
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
    navigateMock.mockClear();
    cashflowCalls.length = 0;
    mockRole = 'USER';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('renders the nine owner-facing command-center sections in one semantic reading order', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(getDashboardSnapshot).toHaveBeenCalled();
    const text = container?.textContent ?? '';
    expect(text).toContain('نبض المكتب');
    expect(text).toContain('أداء المكتب');
    expect(text).toContain('يحتاج انتباهك');
    expect(text).toContain('الإشغال والشغور');
    expect(text).toContain('التحصيل والمتأخرات');
    expect(text).toContain('الصيانة');
    expect(text).toContain('العقود القادمة');
    expect(text).toContain('صحة العقارات');
    expect(text).toContain('مستحقات الملاك');

    const sectionOrder = Array.from(container?.querySelectorAll('[data-dashboard-section]') ?? [])
      .map((section) => section.getAttribute('data-dashboard-section'));
    expect(sectionOrder).toEqual([
      'needs-attention',
      'office-pulse',
      'collections',
      'occupancy',
      'maintenance',
      'upcoming-contracts',
      'property-health',
      'financial-performance',
      'owner-obligations',
    ]);
  });

  it('does not add a duplicate focus rail or hide owner information behind dashboard-only disclosure', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    expect(container?.querySelector('[data-dashboard-focus-strip]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-secondary-disclosure]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="finance-exceptions"]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="needs-attention"]')?.getAttribute('data-dashboard-priority')).toBe('attention');
    expect(container?.querySelector('[data-dashboard-section="property-health"]')?.textContent).toContain('برج الخليج');
  });

  it('keeps page identity plus day and date in the canonical PageHeader without a routine refresh action', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    const todayContext = container?.querySelector<HTMLElement>('[data-global-today-context]');
    expect(todayContext).not.toBeNull();
    expect(container?.querySelector('h1')?.textContent).toBe('اليوم');
    expect(container?.querySelector('[data-page-primary-action] button')).toBeNull();
    expect(Array.from(container?.querySelectorAll('button') ?? []).some((button) => button.textContent?.includes('تحديث'))).toBe(false);
  });

  it('renders four Office Pulse surfaces with the authoritative snapshot numbers', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const pulse = container?.querySelector('[data-dashboard-office-pulse]');
    expect(pulse).not.toBeNull();
    expect(pulse?.querySelectorAll('[data-kpi-card]')).toHaveLength(4);
    const pulseText = pulse?.textContent ?? '';
    expect(pulseText).toContain('التحصيل هذا الشهر');
    expect(pulseText).toContain('80%');
    expect(pulseText).toContain('4 مشغولة · 1 شاغرة');
    expect(pulseText).toContain('فاتورة متأخرة');
    expect(pulseText).toContain('التحصيل ناقص المصروفات المسجلة');
    expect(pulse?.querySelector('[data-dashboard-sparkline]')).not.toBeNull();
  });

  it('shows the monthly cash series through the canonical Reports service with a working window selector', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container?.querySelector('[data-dashboard-section="financial-performance"]');
    expect(section?.textContent).toContain('أداء المكتب');
    expect(section?.querySelector('[data-dashboard-performance-summary]')).not.toBeNull();
    expect(section?.querySelector('[data-dashboard-performance-empty]')).toBeNull();
    expect(cashflowCalls.length).toBeGreaterThan(0);
    const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const expectedSixMonthStart = monthKey(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    const expectedYearStart = monthKey(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    expect(cashflowCalls[0].dateFrom.slice(0, 7)).toBe(expectedSixMonthStart);

    const yearToggle = section?.querySelector<HTMLButtonElement>('[data-dashboard-performance-window="year"]');
    await act(async () => yearToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(cashflowCalls.at(-1)?.dateFrom.slice(0, 7)).toBe(expectedYearStart);
  });

  it('builds the needs-attention queue from real conditions with workspace routing', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container?.querySelector('[data-dashboard-section="needs-attention"]');
    expect(section).not.toBeNull();
    const links = Array.from(section?.querySelectorAll('[data-needs-attention-link]') ?? []);
    expect(links.length).toBeGreaterThanOrEqual(3);
    expect(links[0]?.textContent).toContain('أحمد الفارسي');
    expect(links[0]?.getAttribute('href')).toBe('/arrears');
    expect(links.filter((link) => link.getAttribute('href') === '/maintenance')).toHaveLength(1);
    const contractRow = links.find((link) => link.textContent?.includes('سالم الكعبي'));
    expect(contractRow).not.toBeUndefined();
    await act(async () => contractRow?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ to: '/contracts/$contractId', params: { contractId: 'contract-1' } }));
  });

  it('keeps occupancy server-authoritative and presents vacancy aging honestly', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container?.querySelector('[data-dashboard-section="occupancy"]');
    expect(section?.textContent).toContain('الإشغال والشغور');
    expect(section?.textContent).toContain('80%');
    expect(section?.textContent).toContain('مشغولة / شاغرة');
    expect(section?.textContent).toContain('0–15 يوم');
    expect(section?.textContent).toContain('+60 يوم');
    expect(section?.querySelector('[data-dashboard-queue-link]')).not.toBeNull();
    expect(section?.textContent).toContain('برج الخليج');
  });

  it('presents collection progress and the authoritative arrears aging buckets', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container?.querySelector('[data-dashboard-section="collections"]');
    expect(section?.textContent).toContain('تحصيل يونيو');
    expect(section?.textContent).toContain('المستحق');
    expect(section?.textContent).toContain('المحصّل');
    expect(section?.textContent).toContain('المتبقي');
    expect(section?.textContent).toContain('أعمار المتأخرات');
    expect(section?.textContent).toContain('1–30 يوم');
    expect(section?.textContent).toContain('+90 يوم');
    expect(section?.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('shows the maintenance operational summary with resolution time and top cases only', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container?.querySelector('[data-dashboard-section="maintenance"]');
    const summary = section?.querySelector('[data-dashboard-maintenance-summary]');
    expect(summary).not.toBeNull();
    expect(section?.textContent).toContain('متوسط زمن الإنجاز');
    expect(section?.textContent).toContain('تسرب مياه');
    expect(section?.textContent).toContain('التزامات المرافق');
  });

  it('splits upcoming contracts into the authoritative expiry buckets', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container?.querySelector('[data-dashboard-section="upcoming-contracts"]');
    expect(section?.querySelector('[data-dashboard-contract-buckets]')).not.toBeNull();
    expect(section?.textContent).toContain('≤ 30 يوماً');
    expect(section?.textContent).toContain('61–90 يوماً');
    expect(section?.textContent).toContain('سالم الكعبي');
  });

  it('classifies property health transparently and keeps it directly visible', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const section = container?.querySelector('[data-dashboard-section="property-health"]');
    expect(section?.textContent).toContain('برج الياسمين');
    expect(section?.textContent).toContain('برج الخليج');
    expect(section?.textContent).toContain('جيد');
    expect(section?.textContent).toMatch(/يحتاج متابعة|يحتاج تدخل/);
    expect(section?.querySelector('[data-dashboard-signal-collapse-toggle]')).toBeNull();
  });

  it('keeps owner obligations visible while financial exceptions stay in the unified decision queue', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    const ownerLink = container?.querySelector<HTMLAnchorElement>('[data-dashboard-owner-obligations-link]');
    expect(ownerLink?.getAttribute('href')).toBe('/owner-settlements');
    expect(container?.querySelector('[data-dashboard-owner-obligations-breakdown]')).not.toBeNull();
    expect(container?.querySelector('[data-dashboard-section="finance-exceptions"]')).toBeNull();
    const attention = container?.querySelector('[data-dashboard-section="needs-attention"]');
    expect(attention?.textContent).toContain('حركة بنكية غير مطابقة');
    expect(attention?.textContent).toContain('تسوية ملاك');
  });

  it('keeps setup shortcuts permission-gated for ADMIN/MANAGER only', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(container?.querySelector('[data-dashboard-onboarding-slot]')).toBeNull();

    act(() => { root.unmount(); });
    root = createRoot(container as HTMLDivElement);
    mockRole = 'MANAGER';
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(container?.querySelector('[data-dashboard-onboarding-slot]')).not.toBeNull();
  });

  it('handles query loading state without fabricating current work', async () => {
    (getDashboardSnapshot as any).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
    });
    expect(container?.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(0);
    expect(container?.querySelector('[data-dashboard-office-pulse] [data-kpi-card]')).toBeNull();
  });

  it('stays honest on failure: no fake zero command-center surfaces replace the failed snapshot', async () => {
    (getDashboardSnapshot as any).mockRejectedValue(new Error('network down'));
    await renderPage();
    const text = container?.textContent ?? '';
    expect(text).toContain('تعذر تحميل بيانات اليوم');
    expect(container?.querySelector('[data-dashboard-office-pulse]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-owner-obligations-link]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="collections"]')).toBeNull();
  });

  it('offers retry on failure and re-runs the authoritative read', async () => {
    (getDashboardSnapshot as any).mockRejectedValue(new Error('network down'));
    await renderPage();
    const retry = Array.from(container?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('إعادة المحاولة'));
    expect(retry).not.toBeUndefined();
    await act(async () => retry?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect((getDashboardSnapshot as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the last successful view when a background refresh fails (stale data)', async () => {
    vi.stubEnv('VITE_E2E', 'true');
    const attempt = { count: 0 };
    (getDashboardSnapshot as any).mockImplementation(() => {
      attempt.count += 1;
      return attempt.count === 1 ? Promise.resolve(mockSnapshot) : Promise.reject(new Error('refetch down'));
    });
    await renderPage();
    expect(container?.querySelector('[data-dashboard-office-pulse]')).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event('malek-dashboard-e2e-refetch'));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });

    const text = container?.textContent ?? '';
    expect(text).toContain('تعذر تحديث بيانات اليوم');
    expect(container?.querySelector('[data-dashboard-office-pulse]')).not.toBeNull();
    expect(container?.querySelector('[data-dashboard-owner-obligations-link]')).not.toBeNull();
  });
});
