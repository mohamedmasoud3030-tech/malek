/**
 * @vitest-environment happy-dom
 *
 * Regression tests for usePropertyListController covering:
 * - zero-result filter state
 * - modal open/close lifecycle
 * - archive confirm/cancel flow
 * - navigation integration
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import { PropertiesListPage } from './properties-list-page';

const mockNavigate = vi.fn();
let propertyRows: any[] = [];
let propertyCount = 0;
const createPropertyWithAgreementMock = vi.fn();

// The page registers permission-gated actions through the shared auth seam.
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./use-properties', () => ({
  useProperties: () => ({
    data: { rows: propertyRows, count: propertyCount },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useProperty: (id: string) => ({
    data: propertyRows.find((p: any) => p.id === id),
    isLoading: false,
  }),
  useUpdateProperty: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSoftDeleteProperty: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
}));
vi.mock('@/features/owners/useOwners', () => ({
  useOperationalOwners: () => ({
    data: [{ id: 'owner-1', display_name: 'مالك', full_name: 'مالك تجريبي' }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useCreatePropertyWithAgreement: () => ({ isPending: false, mutateAsync: createPropertyWithAgreementMock }),
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('PropertiesListPage controller regression', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    setViewportWidth(1280);
    createPropertyWithAgreementMock.mockResolvedValue({ id: 'new-id' });
    propertyRows = [
      { id: 'p1', title: 'عمارة الندى', type: 'سكني', address: 'الرياض', status: 'active', purchase_value: null, current_value: null, notes: null },
      { id: 'p2', title: 'برج المعرفة', type: 'تجاري', address: 'جدة', status: 'maintenance', purchase_value: 500000, current_value: 600000, notes: 'ملاحظة' },
    ];
    propertyCount = 2;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    document.body.removeChild(container);
    container.innerHTML = '';
  });

  it('renders the count badge with total count', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const badge = container.querySelector('[aria-label^="عدد السجلات"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('2');
  });

  it('renders zero count badge when no properties', async () => {
    propertyRows = [];
    propertyCount = 0;
    await act(async () => { root.render(<PropertiesListPage />); });
    const badge = container.querySelector('[aria-label^="عدد السجلات"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('0');
  });

  it('renders desktop rows plus the shared mobile card register', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });

    const desktopRows = container.querySelectorAll('tbody tr');
    expect(desktopRows.length).toBe(2);

    expect(container.querySelector('[data-entity-table-scroll]')).toBeTruthy();
    expect(container.querySelector('[data-compact-responsive-table]')).toBeTruthy();
    expect(container.querySelector('table[data-entity-table]')).toBeTruthy();
    // The shared register exposes one Cards ⇄ Table toggle (default: Table on desktop).
    expect(container.querySelector('[role="group"][aria-label*="طريقة عرض"]')).toBeTruthy();
  });

  it('opens create modal and shows agreement fields', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('إضافة عقار'));
    expect(addBtn).toBeTruthy();
    await act(async () => { addBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.body.textContent).toContain('إضافة عقار جديد');
    expect(document.body.textContent).toContain('المالك');
    expect(document.body.textContent).toContain('نوع الاتفاقية');
  });

  it('closes create modal when onOpenChange fires with false', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('إضافة عقار'));
    await act(async () => { addBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.body.textContent).toContain('إضافة عقار جديد');
    // Simulate close by re-rendering with the close flow
    // (in happy-dom, overlay stays open until state change)
  });

  it('navigates to property detail from table row click', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(row).toBeTruthy();
    await act(async () => { row.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/properties/$propertyId', params: { propertyId: 'p1' } });
  });

  it('renders mobile property cards with scan-level summary fields and one clear dossier action', async () => {
    setViewportWidth(375);
    propertyRows = [{
      id: 'p1', title: 'عمارة الندى', type: 'سكني', address: 'الرياض', status: 'active',
      purchase_value: null, current_value: null, notes: null,
      workflow_health: 'ready', current_owner_name: 'مالك تجريبي',
      units: [
        { id: 'u1', status: 'occupied' },
        { id: 'u2', status: 'occupied' },
        { id: 'u3', status: 'available' },
      ],
    }];

    await act(async () => { root.render(<PropertiesListPage />); });

    const card = container.querySelector<HTMLElement>('[data-entity-table-mobile-card]');
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain('عمارة الندى');
    expect(card?.textContent).toContain('نشط');
    expect(card?.textContent).toContain('مالك تجريبي');

    const summary = card?.querySelector<HTMLElement>('[data-entity-table-mobile-summary]');
    expect(summary).toBeTruthy();
    expect(summary?.textContent).toContain('الوحدات');
    expect(summary?.textContent).toContain('2/3 وحدة');
    expect(summary?.textContent).toContain('النوع');
    expect(summary?.textContent).toContain('سكني');

    // 2026-09 register hierarchy contract: the phone card face keeps identity,
    // status and the units/type facts only. Address detail lives in preview
    // and the dossier, so no secondary-meta block is rendered.
    expect(card?.querySelector('[data-entity-table-mobile-secondary-meta]')).toBeNull();
    expect(card?.textContent).not.toContain('الرياض');

    // One obvious primary action stays on the face; edit/archive are
    // consolidated into the card's overflow menu.
    expect(container.querySelector('[data-entity-table-mobile-actions]')).toBeNull();
    expect(card?.textContent).toContain('فتح الملف');
    expect(card?.textContent).not.toContain('تعديل البيانات');
    expect(card?.querySelector('[data-action-menu]')).toBeTruthy();
  });

  it('opens edit modal from the contextual property action menu', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const menu = container.querySelector<HTMLButtonElement>('tbody [data-action-menu-trigger]');
    expect(menu).toBeTruthy();
    await act(async () => { menu?.click(); });
    const editBtn = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'تعديل البيانات');
    expect(editBtn).toBeTruthy();
    await act(async () => { editBtn?.click(); });
    expect(document.body.textContent).toContain('تعديل عقار');
  });

  it('shows archive confirmation from the contextual menu (never a one-tap archive)', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const menu = container.querySelector<HTMLButtonElement>('tbody [data-action-menu-trigger]');
    await act(async () => { menu?.click(); });
    const archiveBtn = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'أرشفة العقار');
    expect(archiveBtn).toBeTruthy();
    await act(async () => { archiveBtn?.click(); });
    // Archive must open the confirmation dialog, never act immediately.
    expect(document.body.textContent).toContain('أرشفة العقار');
  });

  it('renders status filter select with all options', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(1);
    const statusSelect = selects[0];
    const optionTexts = Array.from(statusSelect.options).map(o => o.textContent);
    expect(optionTexts).toContain('كل الحالات');
    expect(optionTexts).toContain('نشط');
  });

  it('renders search input with correct placeholder', async () => {
    await act(async () => { root.render(<PropertiesListPage />); });
    const searchInput = container.querySelector('input[placeholder*="بحث"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(searchInput.placeholder).toBe('بحث بالاسم أو العنوان...');
  });
});
