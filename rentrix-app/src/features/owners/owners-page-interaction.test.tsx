// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { OwnersPage } from './OwnersPage';

const createOwnerMock = vi.fn();
const updateOwnerMock = vi.fn();
let ownersRows: any[] = [];
let propertiesRows: any[] = [];

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to }: any) => <a href={params?.ownerId ? `/owners/${params.ownerId}` : params?.propertyId ? `/properties/${params.propertyId}` : to}>{children}</a>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./useOwners', () => ({
  useOwners: () => ({ data: ownersRows, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreateOwner: () => ({ isPending: false, mutateAsync: createOwnerMock }),
  useUpdateOwner: () => ({ isPending: false, mutateAsync: updateOwnerMock }),
  usePropertiesWithOwners: () => ({ data: propertiesRows, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useOwnerActiveContracts: () => ({ data: [{ id: 'contract-1', property_id: 'property-1' }], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useLinkOwnerToProperty: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdatePropertyOwnerLink: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUnlinkOwnerFromProperty: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

describe('OwnersPage actual owner-model mobile workflow interactions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    createOwnerMock.mockResolvedValue({ id: 'owner-new' });
    updateOwnerMock.mockResolvedValue({ id: 'owner-1' });
    ownersRows = [{
      id: 'owner-1',
      full_name: 'مالك الاختبار',
      display_name: 'أبو ندى',
      phone: '+96890000000',
      email: 'owner@example.com',
      national_id: 'OWN-1234',
      tax_number: null,
      address: 'مسقط',
      notes: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }];
    propertiesRows = [{
      id: 'property-1',
      title: 'عقار المالك',
      type: 'سكني',
      address: 'مسقط',
      owner_name: null,
      purchase_value: null,
      current_value: null,
      status: 'active',
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      property_owners: [{
        id: 'link-1',
        property_id: 'property-1',
        owner_id: 'owner-1',
        ownership_percentage: 100,
        is_primary: true,
        starts_on: null,
        ends_on: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        owner: ownersRows[0],
      }],
    }];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    document.body.innerHTML = '';
  });

  it('opens the owner create form from the header and shows inline Arabic validation', async () => {
    await act(async () => root.render(<OwnersPage />));

    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('إضافة مالك'));
    expect(addButton).toBeTruthy();
    await act(async () => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('إضافة مالك');
    expect(document.body.textContent).toContain('اسم المالك');
    expect(document.body.textContent).toContain('الهاتف');
    expect(document.body.textContent).toContain('البريد الإلكتروني');

    const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('إنشاء المالك'));
    await act(async () => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('اسم المالك مطلوب');
  });

  it('exposes detail, statement, relationships, and edit actions on the mobile card', async () => {
    await act(async () => root.render(<OwnersPage />));

    expect(container.textContent).toContain('عقار المالك');
    expect(container.querySelector('a[href="/owners/owner-1"]')?.textContent).toContain('التفاصيل');
    expect(container.querySelector('a[href="/reports"]')?.textContent).toContain('كشف الحساب');

    const editButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تعديل'));
    expect(editButton).toBeTruthy();
    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('تعديل بيانات المالك');
    expect((document.body.querySelector('input[value="مالك الاختبار"]') as HTMLInputElement | null)).toBeTruthy();
  });

  it('exposes the empty-state create action', async () => {
    ownersRows = [];
    propertiesRows = [];
    await act(async () => root.render(<OwnersPage />));
    expect(container.textContent).toContain('لا يوجد ملاك');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('إضافة مالك'))).toBe(true);
  });
});
