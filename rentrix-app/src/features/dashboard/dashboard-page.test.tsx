// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './dashboard-page';
import { getDashboardSnapshot } from './dashboard-snapshot';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: any) => children,
  useNavigate: () => vi.fn(),
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

  it('renders the core dashboard and calls getDashboardSnapshot at the service boundary', async () => {
    // Configure getDashboardSnapshot mock resolved value
    (getDashboardSnapshot as any).mockResolvedValue(mockSnapshot);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DashboardPage />
        </QueryClientProvider>
      );
    });

    // Verify getDashboardSnapshot was invoked at least once
    expect(getDashboardSnapshot).toHaveBeenCalled();

    // Verify the rendered DOM is updated with mock snapshot data
    // (Wait for React Query's state update to render, which is automatic on promise resolve)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const text = container?.textContent ?? '';

    // 1. Dashboard title / operating overview
    expect(text).toContain('لوحة التحكم');
    expect(text).toContain('صورة الأداء');
    expect(text).toContain('نسبة الإشغال');

    // 2. Quick Actions
    expect(text).toContain('إجراءات سريعة');
    expect(text).toContain('إنشاء عقد');

    // 3. Expiring contracts section
    expect(text).toContain('العقود المنتهية قريباً');
    expect(text).toContain('سالم الكعبي');

    // 4. Overdue items section
    expect(text).toContain('أعلى المتأخرات');
    expect(text).toContain('أحمد الفارسي');

    // 5. Decision hierarchy and reduced duplication
    expect(text).toContain('الأولوية الآن');
    expect(text).toContain('قوائم العمل');
    expect(text).toContain('المحفظة والتحصيل');
    expect(text).toContain('حالة التحصيل');

    const sectionOrder = Array.from(container?.querySelectorAll('[data-dashboard-section]') ?? [])
      .map((section) => section.getAttribute('data-dashboard-section'));
    expect(sectionOrder).toEqual(['kpis', 'priorities', 'trends', 'work-queues']);
    expect(container?.querySelectorAll('[data-dashboard-action-grid] > *')).toHaveLength(4);
    expect(container?.querySelectorAll('[data-dashboard-kpi-grid] [class*="grid-cols-2"] > *')).toHaveLength(4);
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
});
