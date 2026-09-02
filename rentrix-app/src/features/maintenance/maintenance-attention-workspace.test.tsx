/**
 * P3 — the maintenance register must expose the two operational problems the
 * status counters hid: work that stopped moving, and completed work nobody
 * closed. Rendered through the real page so the controller, register and
 * summary strip are proved together.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceWorkspace } from './components/maintenance-workspace';

const maintenanceMocks = vi.hoisted(() => ({
  createMutation: { isPending: false, mutate: vi.fn() },
  maintenanceQuery: { data: [] as unknown[], error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  propertiesQuery: { data: { rows: [] as unknown[] }, error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  allUnitsQuery: { data: [] as unknown[], isLoading: false },
  unitsQuery: { data: [] as unknown[], isLoading: false },
  providerCategoriesQuery: { data: [] as unknown[], error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  providerOptionsQuery: { data: [] as unknown[], error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  updateRequestMutation: { isPending: false, mutate: vi.fn() },
  updateStatusMutation: { isPending: false, mutate: vi.fn() },
  resolveMutation: { isPending: false, mutate: vi.fn() },
}));

vi.mock('@tanstack/react-router', () => ({
  useMatches: () => [],
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@/hooks/use-company', () => ({
  ACTIVE_COMPANY_ERROR: 'تعذر تحديد الشركة النشطة',
  useActiveCompanyId: () => '00000000-0000-4000-8000-000000000001',
}));

vi.mock('@/features/properties/use-properties', () => ({
  useProperties: () => maintenanceMocks.propertiesQuery,
}));

vi.mock('@/features/units/use-units', () => ({
  useAllUnits: () => maintenanceMocks.allUnitsQuery,
  useUnits: () => maintenanceMocks.unitsQuery,
}));

vi.mock('@/features/service-providers/use-service-providers', () => ({
  useServiceProviderCategories: () => maintenanceMocks.providerCategoriesQuery,
  useActiveServiceProviderOptions: () => maintenanceMocks.providerOptionsQuery,
}));

vi.mock('./use-maintenance', () => ({
  useCreateMaintenance: () => maintenanceMocks.createMutation,
  useMaintenance: () => maintenanceMocks.maintenanceQuery,
  useUpdateMaintenance: () => maintenanceMocks.updateRequestMutation,
  useUpdateMaintenanceStatus: () => maintenanceMocks.updateStatusMutation,
  useCloseMaintenanceWithExpense: () => maintenanceMocks.resolveMutation,
}));

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => ({
    isReady: true,
    isLoading: false,
    companySettings: { companyName: 'شركة الاختبار', currency: 'OMR', currencySymbol: 'ر.ع', documentPrefixes: {} },
  }),
}));

function row(overrides: Record<string, unknown>) {
  return {
    id: 'maintenance-1',
    property_id: 'property-1',
    unit_id: null,
    service_provider_id: null,
    service_provider_category_id: null,
    title: 'طلب صيانة',
    description: null,
    priority: 'medium',
    status: 'open',
    assigned_to: null,
    cost: 0,
    request_date: '2026-08-27',
    scheduled_date: null,
    resolved_at: null,
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('maintenance operational attention in the register (P3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T09:00:00Z'));
    maintenanceMocks.maintenanceQuery.error = null;
    maintenanceMocks.maintenanceQuery.isError = false;
    maintenanceMocks.maintenanceQuery.isLoading = false;
    maintenanceMocks.propertiesQuery.data = { rows: [{ id: 'property-1', title: 'برج النخيل' }] };
    maintenanceMocks.allUnitsQuery.data = [];
    maintenanceMocks.unitsQuery.data = [];
    maintenanceMocks.providerCategoriesQuery.data = [];
    maintenanceMocks.providerOptionsQuery.data = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts requests awaiting closure and requests that stopped moving', () => {
    maintenanceMocks.maintenanceQuery.data = [
      row({ id: 'stalled', title: 'تسرب قديم', request_date: '2026-08-01' }),
      row({ id: 'awaiting', title: 'تكييف مكتمل', status: 'resolved' }),
      row({ id: 'fresh', title: 'بلاغ اليوم' }),
    ];

    const html = renderToStaticMarkup(<MaintenanceWorkspace mode="embedded" />);

    expect(html).toContain('بانتظار الإغلاق');
    expect(html).toContain('متوقفة عن التقدم');
  });

  it('shows how long each request has been waiting', () => {
    maintenanceMocks.maintenanceQuery.data = [row({ id: 'stalled', request_date: '2026-08-01' })];

    const html = renderToStaticMarkup(<MaintenanceWorkspace mode="embedded" />);

    expect(html).toContain('منذ 26 يوم');
  });

  it('flags a scheduled visit the office already missed', () => {
    maintenanceMocks.maintenanceQuery.data = [row({ id: 'missed', scheduled_date: '2026-08-20' })];

    const html = renderToStaticMarkup(<MaintenanceWorkspace mode="embedded" />);

    expect(html).toContain('تجاوزت موعد الزيارة');
  });

  it('offers an operational follow-up filter next to status and priority', () => {
    maintenanceMocks.maintenanceQuery.data = [row({ id: 'fresh' })];

    const html = renderToStaticMarkup(<MaintenanceWorkspace mode="embedded" />);

    expect(html).toContain('تصفية حسب المتابعة التشغيلية');
  });

  it('keeps a healthy register free of attention noise', () => {
    maintenanceMocks.maintenanceQuery.data = [row({ id: 'fresh', title: 'بلاغ اليوم' })];

    const html = renderToStaticMarkup(<MaintenanceWorkspace mode="embedded" />);

    expect(html).toContain('بلاغ اليوم');
    // Only the filter option mentions each attention state; no metric chip and
    // no row badge appear for a register with nothing to chase.
    expect(html.match(/متوقفة عن التقدم/g)).toHaveLength(1);
    expect(html.match(/تجاوزت موعد الزيارة/g)).toHaveLength(1);
    expect(html).not.toContain('منذ');
  });
});
