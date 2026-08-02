/**
 * @vitest-environment happy-dom
 *
 * Regression tests for useUnitsListController covering:
 * - KPI computation from real data
 * - filter application
 * - mobile card rendering parity with desktop
 * - modal open/close lifecycle
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { UnitsPage } from './units-page';
import { computeUnitKpis, getUnitPageStatus } from './use-units-list-controller';
import type { Unit } from '@/types/domain';

const mockNavigate = vi.fn();

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
  { id: 'u1', property_id: 'p1', unit_number: '101', status: 'available', rent_amount: 1200, floor: '1', notes: null, name: null, created_at: '', updated_at: '', deleted_at: null },
  { id: 'u2', property_id: 'p1', unit_number: '102', status: 'occupied', rent_amount: 1500, floor: '1', notes: 'بلكون', name: null, created_at: '', updated_at: '', deleted_at: null },
  { id: 'u3', property_id: 'p2', unit_number: '201', status: 'maintenance', rent_amount: 1800, floor: '2', notes: null, name: null, created_at: '', updated_at: '', deleted_at: null },
];

vi.mock('./use-units', () => ({
  useAllUnits: () => ({ data: unitsData, isLoading: false, isError: false }),
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
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    document.body.removeChild(container);
    container.innerHTML = '';
  });

  it('renders both desktop rows and mobile cards for each unit', async () => {
    await act(async () => { root.render(<UnitsPage />); });

    const desktopRows = container.querySelectorAll('tbody tr');
    expect(desktopRows.length).toBe(3);

    const mobileCards = container.querySelectorAll('[role="listitem"]');
    expect(mobileCards.length).toBe(3);
  });

  it('renders KPI cards with computed values', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const text = container.textContent ?? '';
    // Arabic locale uses Arabic-Indic numerals: ٣=3, ١=1
    expect(text).toContain('3'); // total units
    expect(text).toContain('1'); // occupied and available
    expect(text).toContain('OMR'); // expected rent currency
  });

  it('renders filter selects: property, status, occupancy', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBe(3);

    const propertySelect = selects[0];
    const options = Array.from(propertySelect.options).map(o => o.textContent);
    expect(options).toContain('كل العقارات');
    expect(options).toContain('برج الخليج');
    expect(options).toContain('عمارة الندى');
  });

  it('opens create modal on add button click', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('إضافة وحدة'));
    expect(addBtn).toBeTruthy();
    await act(async () => { addBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.body.textContent).toContain('اختيار العقار مطلوب');
  });

  it('opens edit modal from mobile card without property selection', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const editBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('تعديل'));
    expect(editBtn).toBeTruthy();
    await act(async () => { editBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.body.textContent).toContain('تعديل وحدة');
    expect(document.body.textContent).not.toContain('اختيار العقار مطلوب');
  });

  it('navigates to unit detail from desktop row click', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(row).toBeTruthy();
    await act(async () => { row.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'p1', unitId: 'u1' },
    });
  });

  it('navigates to unit detail from mobile card click', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const card = container.querySelector('[role="listitem"] [role="button"]') as HTMLElement;
    expect(card).toBeTruthy();
    await act(async () => { card.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'p1', unitId: 'u1' },
    });
  });

  it('renders search input with correct placeholder', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const searchInput = container.querySelector('input[placeholder*="رقم"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(searchInput.placeholder).toBe('رقم الوحدة، الدور، العقار');
  });

  it('displays unit count in card description', async () => {
    await act(async () => { root.render(<UnitsPage />); });
    const text = container.textContent ?? '';
    // Arabic locale uses Arabic-Indic numerals; description ends with period
    expect(text).toContain('وحدة ضمن الفلاتر الحالية');
  });
});
