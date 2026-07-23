import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenancePage } from './maintenance-page';

const maintenanceMocks = vi.hoisted(() => ({
  createMutation: { isPending: false, mutate: vi.fn() },
  maintenanceQuery: { data: [] as unknown[], error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  propertiesQuery: { data: { rows: [] as unknown[] }, error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  allUnitsQuery: { data: [] as unknown[], isLoading: false },
  unitsQuery: { data: [] as unknown[], isLoading: false },
  updateRequestMutation: { isPending: false, mutate: vi.fn() },
  updateStatusMutation: { isPending: false, mutate: vi.fn() },
  resolveMutation: { isPending: false, mutate: vi.fn() },
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

vi.mock('./use-maintenance', () => ({
  useCreateMaintenance: () => maintenanceMocks.createMutation,
  useMaintenance: () => maintenanceMocks.maintenanceQuery,
  useUpdateMaintenance: () => maintenanceMocks.updateRequestMutation,
  useUpdateMaintenanceStatus: () => maintenanceMocks.updateStatusMutation,
  useResolveMaintenanceWithExpense: () => maintenanceMocks.resolveMutation,
}));

const maintenanceRow = {
  id: 'maintenance-1',
  property_id: 'property-1',
  unit_id: 'unit-1',
  title: 'إصلاح المكيف',
  description: null,
  priority: 'urgent',
  status: 'in_progress',
  assigned_to: null,
  cost: 0,
  resolved_at: null,
  created_at: '2026-05-17T00:00:00.000Z',
  updated_at: '2026-05-17T00:00:00.000Z',
  deleted_at: null,
};

describe('MaintenancePage recovery states', () => {
  beforeEach(() => {
    maintenanceMocks.maintenanceQuery.data = [];
    maintenanceMocks.maintenanceQuery.error = null;
    maintenanceMocks.maintenanceQuery.isError = false;
    maintenanceMocks.maintenanceQuery.isLoading = false;
    maintenanceMocks.propertiesQuery.data = { rows: [] };
    maintenanceMocks.propertiesQuery.error = null;
    maintenanceMocks.propertiesQuery.isError = false;
    maintenanceMocks.propertiesQuery.isLoading = false;
    maintenanceMocks.allUnitsQuery.data = [];
    maintenanceMocks.unitsQuery.data = [];
  });

  it('renders Arabic maintenance status, priority, and location labels', () => {
    maintenanceMocks.maintenanceQuery.data = [maintenanceRow];
    maintenanceMocks.propertiesQuery.data = { rows: [{ id: 'property-1', title: 'برج النخيل' }] };
    maintenanceMocks.allUnitsQuery.data = [{ id: 'unit-1', property_id: 'property-1', unit_number: 'A-12' }];

    const html = renderToStaticMarkup(<MaintenancePage />);

    expect(html).toContain('إصلاح المكيف');
    expect(html).toContain('برج النخيل / A-12');
    expect(html).toContain('قيد التنفيذ');
    expect(html).toContain('عاجلة');
    expect(html).toContain('تم الحل');
  });

  it('renders a retryable load error state', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    maintenanceMocks.maintenanceQuery.error = new Error('تعذر تحميل صيانة الاختبار');
    maintenanceMocks.maintenanceQuery.isError = true;

    const html = renderToStaticMarkup(<MaintenancePage />);

    expect(html).toContain('تعذر تحميل طلبات الصيانة');
    // In test environment VITE_SUPABASE_URL is absent → getEnvDiagnostics() takes priority
    expect(html).toContain('إعداد الاتصال بقاعدة البيانات غير مكتمل.');
    expect(html).toContain('إعادة المحاولة');
  });
});
