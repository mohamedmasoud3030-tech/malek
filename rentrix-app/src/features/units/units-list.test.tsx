// @vitest-environment happy-dom
import type { UseQueryResult } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Unit } from '@/types/domain';
import { UnitsList } from './units-list';

// The page registers permission-gated actions through the shared auth seam.
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('./unit-form-modal', () => ({
  UnitFormModal: () => null,
}));

vi.mock('./use-units', () => ({
  useSoftDeleteUnit: () => ({ isPending: false, mutate: vi.fn() }),
}));

// The duplicate-draft guard hook (added 2026-08-21) queries drafts via React
// Query. Pin it to an empty result so these load-state tests stay hermetic.
vi.mock('@/features/contracts/queries/useUnitContractDrafts', () => ({
  useUnitContractDrafts: () => ({ data: [], isLoading: false, isError: false }),
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function makeUnitsQuery(overrides: Partial<UseQueryResult<Unit[]>>): UseQueryResult<Unit[]> {
  return {
    data: [],
    error: null,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<Unit[]>;
}

function renderUnitsList(unitsQuery: UseQueryResult<Unit[]>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <UnitsList propertyId="property-1" unitsQuery={unitsQuery} />
    </QueryClientProvider>,
  );
}

describe('UnitsList load states', () => {
  it('surfaces property unit loading failures instead of rendering an empty workflow', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const unitsQuery = makeUnitsQuery({
      data: undefined,
      error: new Error('permission denied for table units'),
      isError: true,
    });

    const html = renderUnitsList(unitsQuery);

    expect(html).toContain('تعذر تحميل وحدات العقار');
    // In test environment VITE_SUPABASE_URL is absent → getEnvDiagnostics() takes priority
    expect(html).toContain('إعداد الاتصال بقاعدة البيانات غير مكتمل.');
    expect(html).toContain('إعادة المحاولة');
    expect(html).not.toContain('لا توجد وحدات');
  });
});

describe('UnitsList mobile card density', () => {
  it('shows unit identity, status, rent and compact overflow actions on the mobile card', () => {
    setViewportWidth(375);
    const unitsQuery = makeUnitsQuery({
      data: [
        {
          id: 'unit-1',
          name: null,
          property_id: 'property-1',
          unit_number: 'A-101',
          floor: 'الدور الثاني',
          status: 'occupied',
          rent_amount: 420,
          daily_reference_rate: null,
          notes: 'تسليم مفتاح تم',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          deleted_at: null,
          company_id: 'company-1',
        },
      ],
    });

    const html = renderUnitsList(unitsQuery);
    const host = document.createElement('div');
    host.innerHTML = html;

    const card = host.querySelector<HTMLElement>('[data-entity-table-mobile-card]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('وحدة A-101');
    expect(card?.textContent).toContain('مشغولة');

    const summary = card?.querySelector<HTMLElement>('[data-entity-table-mobile-summary]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('الإيجار');

    const secondaryMeta = card?.querySelector<HTMLElement>('[data-entity-table-mobile-secondary-meta]');
    expect(secondaryMeta?.textContent).toContain('تسليم مفتاح تم');

    expect(host.querySelector('[data-entity-table-mobile-actions]')).toBeNull();
    expect(card?.querySelector('[data-entity-card-primary]')).not.toBeNull();
    expect(card?.textContent).toContain('تعديل');
    expect(card?.querySelector('[data-action-menu]')).toBeTruthy();
  });
});
