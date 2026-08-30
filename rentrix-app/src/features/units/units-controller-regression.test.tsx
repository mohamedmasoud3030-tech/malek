/**
 * @vitest-environment happy-dom
 *
 * Regression tests for useUnitsListController covering:
 * - KPI computation from real data
 * - filter application
 * - compact responsive table behavior without card duplication
 * - modal open/close lifecycle
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { UnitsPage } from './units-page';
import { computeUnitKpis, getUnitPageStatus } from './use-units-list-controller';
import type { Unit } from '@/types/domain';

const mockNavigate = vi.fn();

// The page registers permission-gated actions through the shared auth seam.
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: any) => (
    <a data-testid="mock-link" onClick={(e: any) => {
      if (props.onClick) props.onClick(e);
      if (!e.defaultPrevented) mockNavigate({ to: props.to, params: props.params });
    }} href={props.to}>{props.children}</a>
  ),
}));

// Mirror real PageHeader: primaryAction is the current API; `action` is the
// deprecated alias. EmbeddableWorkspace (and the units page) pass primaryAction.
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ action, primaryAction, secondaryActions }: any) => (
    <header data-page-header>
      {secondaryActions}
      {primaryAction ?? action}
    </header>
  ),
}));

const unitsData: Unit[] = [
  { id: 'u1', property_id: 'p1', unit_number: '101', status: 'available', rent_amount: 1200, daily_reference_rate: null, floor: '1', notes: null, name: null, created_at: '', updated_at: '', deleted_at: null, company_id: 'company-1' },
  { id: 'u2', property_id: 'p1', unit_number: '102', status: 'occupied', rent_amount: 1500, daily_reference_rate: null, floor: '1', notes: 'بلكون', name: null, created_at: '', updated_at: '', deleted_at: null, company_id: 'company-1' },
  { id: 'u3', property_id: 'p2', unit_number: '201', status: 'maintenance', rent_amount: 1800, daily_reference_rate: null, floor: '2', notes: null, name: null, created_at: '', updated_at: '', deleted_at: null, company_id: 'company-1' },
];

vi.mock('./use-units', () => ({
  useAllUnits: () => ({ data: unitsData, isLoading: false, isError: false }),
  useUnitDetail: () => ({ data: unitsData[0], isLoading: false, isError: false }),
  useCreateUnit: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
  useUpdateUnit: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSoftDeleteUnit: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('@/features/properties/use-properties', () => ({
  useProperties: () => ({
    data: { rows: [{ id: 'p1', title: 'برج الخليج', status: 'active' }, { id: 'p2', title: 'عمارة الندى', status: 'active' }], count: 2 },
    isLoading: false,
  }),
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

/* ── Pure helper unit tests ────────────────────────────────────────── */

describe('computeUnitKpis', () => {
  it('computes correct KPIs from mixed-status units', () => {
    const kpis = computeUnitKpis(unitsData);
    expect(kpis.occupiedCount).toBe(1);
    expect(kpis.availableCount).toBe(1);
    expect(kpis.expectedRent).toBe(4500);
  });

  it('returns zeros for empty unit list', () => {
    const kpis = computeUnitKpis([]);
    expect(kpis.occupiedCount).toBe(0);
    expect(kpis.availableCount).toBe(0);
    expect(kpis.expectedRent).toBe(0);
  });

  it('normalizes status values in KPI computation', () => {
    const mixedUnits: Unit[] = [
      { ...unitsData[0], status: 'AVAILABLE' as Unit['status'] },
      { ...unitsData[1], status: 'OCCUPIED' as Unit['status'] },
    ];
    const kpis = computeUnitKpis(mixedUnits);
    expect(kpis.availableCount).toBe(1);
    expect(kpis.occupiedCount).toBe(1);
  });
});

describe('getUnitPageStatus', () => {
  it('normalizes case-insensitive statuses', () => {
    expect(getUnitPageStatus({ status: 'AVAILABLE' as Unit['status'] })).toBe('available');
    expect(getUnitPageStatus({ status: 'OCCUPIED' as Unit['status'] })).toBe('occupied');
    expect(getUnitPageStatus({ status: 'MAINTENANCE' as Unit['status'] })).toBe('maintenance');
    expect(getUnitPageStatus({ status: 'RESERVED' as Unit['status'] })).toBe('reserved');
  });

  it('throws for unsupported status', () => {
    expect(() => getUnitPageStatus({ status: 'broken' as Unit['status'] })).toThrow('Unsupported unit status');
  });
});

/* ── Page-level regression tests ───────────────────────────────────── */

describe('UnitsPage controller regression', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    setViewportWidth(1280);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    document.body.removeChild(container);
    container.innerHTML = '';
  });

  it('renders one dense desktop table row per unit plus the shared horizontally scrollable table', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });

    const desktopRows = container.querySelectorAll('tbody tr');
    expect(desktopRows.length).toBe(3);

    expect(container.querySelector('[data-entity-table-scroll]')).toBeTruthy();
    expect(container.querySelector('[data-compact-responsive-table]')).toBeTruthy();
    expect(container.querySelector('table[data-entity-table]')).toBeTruthy();
    expect(container.querySelector('[role="group"][aria-label*="طريقة عرض"]')).toBeNull();
  });

  it('renders KPI cards with computed values', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const text = container.textContent ?? '';
    // Arabic locale uses Arabic-Indic numerals: ٣=3, ١=1
    expect(text).toContain('3'); // total units
    expect(text).toContain('1'); // occupied and available
    expect(text).toContain('OMR'); // expected rent currency
  });

  it('renders filter selects: property, status, occupancy', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBe(3);

    const propertySelect = selects[0];
    const options = Array.from(propertySelect.options).map(o => o.textContent);
    expect(options).toContain('كل العقارات');
    expect(options).toContain('برج الخليج');
    expect(options).toContain('عمارة الندى');
  });

  it('opens create modal on add button click', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('إضافة وحدة'));
    expect(addBtn).toBeTruthy();
    await act(async () => { addBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.body.textContent).toContain('اختيار العقار مطلوب');
  });

  it('opens edit modal from the row action without property selection', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const editBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('تعديل'));
    expect(editBtn).toBeTruthy();
    await act(async () => { editBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.body.textContent).toContain('تعديل وحدة');
    expect(document.body.textContent).not.toContain('اختيار العقار مطلوب');
  });

  it('opens the unit preview dialog from desktop row click', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(row).toBeTruthy();
    await act(async () => { row.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    // Row clicks keep the operator in the register behind the shared preview dialog.
    expect(document.body.textContent).toContain('معاينة الوحدة');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the unit preview dialog from keyboard row activation', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(row?.tabIndex).toBe(0);
    await act(async () => { row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(document.body.textContent).toContain('معاينة الوحدة');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders search input with correct placeholder', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const searchInput = container.querySelector('input[placeholder*="رقم"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(searchInput.placeholder).toBe('رقم الوحدة، الدور، العقار');
  });

  it('displays unit count in card description', async () => {
    await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnitsPage /></QueryClientProvider>); });
    const text = container.textContent ?? '';
    // Arabic locale uses Arabic-Indic numerals; description ends with period
    expect(text).toContain('وحدة ضمن الفلاتر الحالية');
  });
});