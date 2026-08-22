import type { UseQueryResult } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Unit } from '@/types/domain';
import { UnitsList } from './units-list';

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
