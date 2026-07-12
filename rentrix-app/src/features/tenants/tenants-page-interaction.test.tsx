// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TenantsPage } from './TenantsPage';

let tenantRows: any[] = [];
const refetchMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to }: any) => <a href={params?.contractId ? `/contracts/${params.contractId}` : to}>{children}</a>,
}));
vi.mock('@/features/people/person-form-modal', () => ({
  PersonFormModal: ({ defaultType, onClose, open, personId }: any) => open ? (
    <div role="dialog" aria-label={personId ? 'تعديل شخص' : 'إضافة شخص'}>
      <p>{personId ? `تعديل ${personId}` : `إنشاء ${defaultType}`}</p>
      <label>الاسم الكامل<input name="full_name" /></label>
      <label>الهاتف<input name="phone" /></label>
      <label>البريد الإلكتروني<input name="email" /></label>
      <label>رقم الهوية<input name="national_id" /></label>
      <button type="button" onClick={onClose}>إغلاق</button>
    </div>
  ) : null,
}));
vi.mock('./useTenantWorkspace', () => ({
  useTenantWorkspace: () => ({
    data: { rows: tenantRows, count: tenantRows.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchMock,
  }),
}));

describe('TenantsPage shared person mobile workflow interactions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    tenantRows = [{
      person: { id: 'person-tenant-1', full_name: 'مستأجر الاختبار', phone: '+96890000000', email: 'tenant@example.com', national_id: 'TEN-1234' },
      activeContractCount: 1,
      primaryContractId: 'contract-1',
      propertyTitle: 'عقار الاختبار',
      unitNumber: 'A-1',
      hasInvoices: true,
      hasArrears: true,
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

  it('opens the tenant create form from the header using the shared person workflow', async () => {
    await act(async () => root.render(<TenantsPage />));

    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('إضافة مستأجر'));
    expect(addButton).toBeTruthy();
    await act(async () => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('إنشاء tenant');
    expect(document.body.textContent).toContain('الاسم الكامل');
    expect(document.body.textContent).toContain('الهاتف');
    expect(document.body.textContent).toContain('البريد الإلكتروني');
    expect(document.body.textContent).toContain('رقم الهوية');
  });

  it('opens edit from the mobile card and keeps all domain links accessible', async () => {
    await act(async () => root.render(<TenantsPage />));

    expect(container.querySelector('a[href="/contracts/contract-1"]')?.textContent).toContain('العقد');
    expect(container.querySelector('a[href="/invoices"]')?.textContent).toContain('الفواتير');
    expect(container.querySelector('a[href="/arrears"]')?.textContent).toContain('المتأخرات');
    expect(container.querySelector('a[href="/reports"]')?.textContent).toContain('كشف الحساب');

    const editButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تعديل'));
    expect(editButton).toBeTruthy();
    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('تعديل person-tenant-1');
  });

  it('exposes an empty-state create action', async () => {
    tenantRows = [];
    await act(async () => root.render(<TenantsPage />));
    expect(container.textContent).toContain('لا توجد سجلات مستأجرين');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('إضافة مستأجر'))).toBe(true);
  });
});
