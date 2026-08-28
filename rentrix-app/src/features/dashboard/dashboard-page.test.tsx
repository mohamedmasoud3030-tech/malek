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
  ownerFunds: { netPayable: 0, settlementsDraft: 1, settlementsApproved: 1 },
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

describe('Today action workspace', () => {
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

  it('renders only queues that need an office action', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    const text = container?.textContent ?? '';
    expect(text).toContain('ما يحتاج إجراء');
    expect(text).toContain('تحصيلات تحتاج متابعة');
    expect(text).toContain('صيانة ومرافق تحتاج قرار');
    expect(text).toContain('عقود تحتاج قرار تجديد');
    expect(text).toContain('تسويات ملاك تحتاج مراجعة');
    expect(text).toContain('أحمد الفارسي');
    expect(text).toContain('سالم الكعبي');
    expect(text).toContain('تسرب مياه');

    expect(container?.querySelector('[data-dashboard-office-pulse]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="vacant-units"]')).toBeNull();
  });

  it('locks the action-only section order', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    const sectionOrder = Array.from(container?.querySelectorAll('[data-dashboard-section]') ?? [])
      .map((section) => section.getAttribute('data-dashboard-section'));
    expect(sectionOrder).toEqual([
      'today-intro',
      'collections',
      'maintenance-problems',
      'expiring-contracts',
      'owner-obligations',
    ]);
  });

  it('keeps each operational queue under its owning decision section', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();
    expect(container?.querySelector('[data-dashboard-section="collections"]')?.textContent).toContain('أعلى المتأخرات');
    expect(container?.querySelector('[data-dashboard-section="expiring-contracts"]')?.textContent).toContain('عقود تنتهي قريباً');
    expect(container?.querySelector('[data-dashboard-section="maintenance-problems"]')?.textContent).toContain('الصيانة العاجلة');
    expect(container?.querySelector('[data-dashboard-owner-obligations-link]')?.textContent).toContain('تسوية بانتظار');
  });

  it('keeps setup onboarding before the action queues for office managers', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    mockRole = 'MANAGER';
    await renderPage();

    const onboardingSlot = container?.querySelector('[data-dashboard-onboarding-slot]');
    const collections = container?.querySelector('[data-dashboard-section="collections"]');
    expect(onboardingSlot).not.toBeNull();
    expect(collections).not.toBeNull();
    if (!onboardingSlot || !collections) throw new Error('Today setup/action slots are required');
    expect(onboardingSlot.compareDocumentPosition(collections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Day + Date in the shared compact Today context strip', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    const todayContext = container?.querySelector<HTMLElement>('[data-global-today-context]');
    expect(todayContext).not.toBeNull();
    expect(container?.querySelector('h1')?.textContent).toBe('اليوم');
    expect(todayContext?.querySelector<HTMLElement>('[data-global-today-weekday]')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(todayContext?.querySelector<HTMLElement>('[data-global-today-day-date]')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(container?.querySelector('[data-header-date-center]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-today-context]')).toBeNull();
  });

  it('keeps an explicit refresh action wired to the snapshot query', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    await renderPage();

    const refresh = container?.querySelector<HTMLButtonElement>('[data-global-refresh]');
    expect(refresh).not.toBeNull();
    expect(refresh?.getAttribute('aria-label')).toBe('تحديث');
    expect(refresh?.className).toContain('size-11');
    await act(async () => refresh?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect((getDashboardSnapshot as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('handles loading without fabricating current work', async () => {
    (getDashboardSnapshot as any).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
    });
    expect(container?.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(0);
  });

  it('stays honest on snapshot failure', async () => {
    (getDashboardSnapshot as any).mockRejectedValue(new Error('network down'));
    await renderPage();
    const text = container?.textContent ?? '';
    expect(text).toContain('تعذر تحميل بيانات اليوم');
    expect(container?.querySelector('[data-dashboard-owner-obligations-link]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="collections"]')).toBeNull();
  });
});
