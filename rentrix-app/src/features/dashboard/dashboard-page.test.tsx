// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './dashboard-page';
import { getDashboardSnapshot } from './dashboard-snapshot';

// Mock TanStack Router — keep the Link contract as a real anchor so
// destination assertions (KPI links, priority links) stay meaningful.
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
  };
});

// Keep dashboard tests focused on the snapshot boundary. The onboarding
// component has its own ADMIN/MANAGER/USER permission matrix tests.
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
      authorization: {
        userId: 'user-1',
        email: 'user@example.com',
        role,
      },
      canAccess: (permission: string) => permissions[role].includes(permission),
    };
  },
}));

// Mock useCompanySettingsContract
vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettingsContract: () => ({
    locale: 'ar-OM',
    currency: 'OMR',
    currencyDecimals: 3,
    dateFormat: 'YYYY-MM-DD',
  }),
}));

// Mock getDashboardSnapshot service boundary
vi.mock('./dashboard-snapshot', () => ({
  getDashboardSnapshot: vi.fn(),
}));

vi.mock('@/features/financials/reconciliation/bankReconciliationService', () => ({
  listBankStatementLines: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/owners/services/owner-settlements-service', () => ({
  listOwnerSettlements: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/system/services/data-integrity-service', () => ({
  runDataIntegrityAudit: vi.fn().mockResolvedValue({ checks: [] }),
}));

const mockSnapshot = {
  period: {
    dateFrom: '2026-06-01',
    dateTo: '2026-06-28',
  },
  operational: {
    properties: 4,
    units: 15,
    activeContracts: 8,
    expiringContracts30Days: 2,
    vacantUnits: 3,
    occupiedUnits: 12,
    occupancyRate: 80,
  },
  financial: {
    rentDue: 15000,
    collectedRent: 12000,
    outstandingRent: 3000,
    expenses: 1500,
    netPosition: 10500,
  },
  activeContracts: [
    {
      id: 'contract-1',
      // Relative date: the dashboard only lists contracts expiring within the
      // next 30 days — a hardcoded date silently filters the fixture out over time.
      end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      properties: { title: 'برج الياسمين' },
      units: { unit_number: '101' },
      people: { full_name: 'سالم الكعبي' },
    }
  ],
  arrears: {
    totalOverdue: 3000,
    overdueInvoiceCount: 2,
    overdueInvoices: [
      {
        invoiceId: 'invoice-1',
        tenantName: 'أحمد الفارسي',
        propertyTitle: 'برج الخليج',
        unitNumber: '5',
        dueDate: '2026-06-10',
        daysOverdue: 18,
        remainingAmount: 1500,
      }
    ],
    agedReceivables: {
      buckets: {
        days_1_30: { total: 1500, invoiceCount: 1 },
        days_31_60: { total: 1500, invoiceCount: 1 },
        days_61_90: { total: 0, invoiceCount: 0 },
        days_90_plus: { total: 0, invoiceCount: 0 },
      }
    }
  }
};

describe('Modular DashboardPage Query Boundary Tests', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'USER';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    if (container) {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
      container = null;
    }
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DashboardPage />
        </QueryClientProvider>
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

  it('renders the core dashboard and calls getDashboardSnapshot at the service boundary', async () => {
    // Configure getDashboardSnapshot mock resolved value
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);

    await renderPage();

    // Verify getDashboardSnapshot was invoked at least once
    expect(getDashboardSnapshot).toHaveBeenCalled();

    const text = container?.textContent ?? '';

    // 1. Dashboard title / operating overview
    expect(text).toContain('لوحة التحكم');
    expect(text).toContain('صورة الأداء');
    expect(text).toContain('نسبة الإشغال');

    // 2. Expiring contracts section
    expect(text).toContain('العقود المنتهية قريباً');
    expect(text).toContain('سالم الكعبي');

    // 3. Overdue items section
    expect(text).toContain('أعلى المتأخرات');
    expect(text).toContain('أحمد الفارسي');

    // 4. Decision hierarchy and reduced duplication
    expect(text).toContain('الأولوية الآن');
    expect(text).toContain('قوائم العمل');
    expect(text).toContain('المحفظة والتحصيل');
    expect(text).toContain('حالة التحصيل');
  });

  it('scopes Visual Contract V2 on a real Dashboard-owned wrapper', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);

    await renderPage();

    const scope = container?.querySelector('[data-visual-contract="v2"]');
    expect(scope).not.toBeNull();
    // The scope is the Dashboard subtree root: hero + every section live inside it.
    expect(scope?.querySelector('[data-dashboard-hero]')).not.toBeNull();
    expect(scope?.querySelectorAll('[data-dashboard-section]').length).toBeGreaterThanOrEqual(4);
    // It must not be confused with the shared PageLayout node.
    expect(container?.querySelector('[data-page-layout][data-visual-contract]')).toBeNull();
  });

  it('orders the deliberate decision hierarchy: priorities, kpis, work queues, trends, analytics', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);

    await renderPage();

    const sectionOrder = Array.from(container?.querySelectorAll('[data-dashboard-section]') ?? [])
      .map((section) => section.getAttribute('data-dashboard-section'));
    expect(sectionOrder).toEqual(['priorities', 'kpis', 'work-queues', 'trends', 'analytics']);
  });

  it('renders KPI surfaces as real destination links', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);

    await renderPage();

    const kpiLinks = Array.from(container?.querySelectorAll('[data-dashboard-kpi-grid] a[data-dashboard-kpi-link]') ?? []);
    expect(kpiLinks).toHaveLength(4);
    const hrefs = kpiLinks.map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/financials', '/arrears', '/reports', '/expenses']);
  });

  it('hides Quick Actions for roles with no actionable permission', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    mockRole = 'USER';

    await renderPage();

    // USER holds none of the quick-action permissions: no dead-end actions.
    expect(container?.querySelectorAll('[data-dashboard-action-grid] > *')).toHaveLength(0);
    expect(container?.textContent ?? '').not.toContain('إجراءات سريعة');
  });

  it('shows every permitted Quick Action for a manager', async () => {
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);
    mockRole = 'MANAGER';

    await renderPage();
    const text = container?.textContent ?? '';

    expect(text).toContain('إجراءات سريعة');
    expect(text).toContain('إنشاء عقد');
    expect(container?.querySelectorAll('[data-dashboard-action-grid] > *')).toHaveLength(4);
  });

  it('handles query loading state correctly by rendering skeletons', async () => {
    // Return a pending promise to keep it in loading state
    (getDashboardSnapshot as any).mockReturnValue(new Promise(() => {}));

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DashboardPage />
        </QueryClientProvider>
      );
    });

    // Check if skeletons are rendered in the DOM
    const skeletons = container?.querySelectorAll('.skeleton-shimmer');
    expect(skeletons?.length).toBeGreaterThan(0);
  });

  it('stays honest on failure: no fake zero KPIs replace the failed snapshot', async () => {
    (getDashboardSnapshot as any).mockRejectedValue(new Error('network down'));

    await renderPage();
    const text = container?.textContent ?? '';

    expect(text).toContain('تعذر تحميل لوحة التحكم');
    // Data sections are suppressed rather than filled with fabricated zeros.
    expect(container?.querySelector('[data-dashboard-kpi-grid]')).toBeNull();
    expect(container?.querySelector('[data-dashboard-section="kpis"]')).toBeNull();
  });
});
