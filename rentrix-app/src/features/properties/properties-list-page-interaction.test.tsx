// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PropertiesListPage } from './properties-list-page';

const mockNavigate = vi.fn();
const createPropertyWithAgreementMock = vi.fn();
let propertyRows: any[] = [];

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./use-properties', () => ({
  useProperties: () => ({
    data: { rows: propertyRows, count: propertyRows.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useProperty: (propertyId: string) => ({
    data: propertyRows.find((property) => property.id === propertyId),
    isLoading: false,
  }),
  useUpdateProperty: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSoftDeleteProperty: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
}));
vi.mock('@/features/owners/useOwners', () => ({
  useOwners: () => ({
    data: [{ id: '11111111-1111-4111-8111-111111111111', display_name: 'مالك تجريبي', full_name: 'مالك تجريبي' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useCreatePropertyWithAgreement: () => ({ isPending: false, mutateAsync: createPropertyWithAgreementMock }),
}));

describe('PropertiesListPage mobile workflow interactions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    createPropertyWithAgreementMock.mockResolvedValue({ id: 'property-new' });
    propertyRows = [
      {
        id: 'property-1',
        title: 'عمارة الندى',
        type: 'سكني',
        address: 'الرياض',
        status: 'active',
        purchase_value: null,
        current_value: null,
        notes: null,
      },
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    document.body.innerHTML = '';
  });

  it('opens PropertyFormModal from the header create action with owner and agreement fields', async () => {
    await act(async () => root.render(<PropertiesListPage />));

    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('إضافة عقار'));
    expect(addButton).toBeTruthy();

    await act(async () => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('إضافة عقار جديد');
    expect(document.body.textContent).toContain('المالك');
    expect(document.body.textContent).toContain('نوع الاتفاقية');
    expect(document.body.textContent).toContain('قيمة العمولة');
  });

  it('opens details from the mobile card and exposes mobile edit', async () => {
    await act(async () => root.render(<PropertiesListPage />));

    const cardButton = container.querySelector('[role="button"]') as HTMLElement | null;
    expect(cardButton).toBeTruthy();
    await act(async () => cardButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/properties/$propertyId', params: { propertyId: 'property-1' } });

    const editButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تعديل'));
    expect(editButton).toBeTruthy();
    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('تعديل عقار');
  });

  it('exposes an empty-state create action', async () => {
    propertyRows = [];
    await act(async () => root.render(<PropertiesListPage />));
    expect(container.textContent).toContain('إضافة أول عقار');
  });

  it('displays zero count in the page header when no properties exist', async () => {
    propertyRows = [];
    await act(async () => root.render(<PropertiesListPage />));
    // The count badge must render "0" (not be hidden due to falsy-zero).
    // The aria-label is "عدد السجلات {count}" so we match the prefix.
    const countBadge = container.querySelector('[aria-label^="عدد السجلات"]');
    expect(countBadge).toBeTruthy();
    expect(countBadge?.textContent?.trim()).toBe('0');
  });
});
