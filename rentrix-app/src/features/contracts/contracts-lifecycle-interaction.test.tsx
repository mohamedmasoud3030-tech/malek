// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ContractsListPage } from './ContractsListPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContractDetailPage } from './ContractDetailPage';

const navigateMock = vi.fn();
const deleteContractMock = vi.fn();
const renewContractMock = vi.fn();
const terminateContractMock = vi.fn();
let contractRows: any[] = [];
let contractDetail: any = null;

vi.mock('../settings/useCompanySettings', async () => {
  const { testCompanySettingsContract } = await import('../../test/companySettingsContractMock');
  return { useCompanySettingsContract: () => testCompanySettingsContract };
});
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to }: any) => <a href={params?.contractId ? `/contracts/${params.contractId}` : to}>{children}</a>,
  useNavigate: () => navigateMock,
  useParams: () => ({ contractId: 'contract-1' }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./contract-form-modal', () => ({
  ContractFormModal: ({ contractId, onClose, open }: any) => open ? (
    <div role="dialog" aria-label={contractId ? 'تعديل عقد' : 'إنشاء عقد'}>
      <p>{contractId ? `تعديل عقد ${contractId}` : 'إنشاء عقد جديد'}</p>
      <label>العقار<select name="property_id" /></label>
      <label>الوحدة<select name="unit_id" /></label>
      <label>المستأجر<select name="tenant_id" /></label>
      <label>تاريخ البداية<input name="start_date" /></label>
      <button type="button" onClick={onClose}>إغلاق</button>
    </div>
  ) : null,
}));
vi.mock('./useContracts', () => ({
  useContracts: () => ({ data: { rows: contractRows, count: contractRows.length }, error: null, isError: false, isLoading: false, refetch: vi.fn() }),
  useContract: () => ({ data: contractDetail, error: null, isError: false, isLoading: false, refetch: vi.fn() }),
  useSoftDeleteContract: () => ({ isPending: false, mutate: deleteContractMock }),
  useRenewContract: () => ({ isPending: false, mutateAsync: renewContractMock }),
  useTerminateContract: () => ({ isPending: false, mutateAsync: terminateContractMock }),
}));
vi.mock('./useContractPayments', () => ({
  useContractPayments: () => ({ data: { invoices: [], payments: [], summary: { invoiceCount: 0, paymentCount: 0, totalInvoiced: 0, totalPaid: 0, totalRemaining: 0 } }, error: null, isError: false, isLoading: false, refetch: vi.fn() }),
}));
vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useAgreementCoverage: () => ({ data: { id: 'agreement-1', starts_on: '2026-01-01', ends_on: null }, isLoading: false, isError: false, error: null }),
}));
vi.mock('./useContractDocuments', () => ({
  useContractDocuments: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useUploadContractDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteContractDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/services/pdfService', () => ({ exportContractToPdf: vi.fn() }));
vi.mock('@/services/action-service', () => ({ openWhatsApp: vi.fn(), printCurrentView: vi.fn(), shareOrCopy: vi.fn().mockResolvedValue('copied') }));

function activeContract() {
  return {
    id: 'contract-1',
    property_id: 'property-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    agreement_id: 'agreement-1',
    renewed_from_id: null,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 1200,
    payment_cycle: 'monthly',
    status: 'active',
    cancellation_reason: null,
    notes: null,
    attachment_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    deleted_at: null,
    people: { id: 'tenant-1', full_name: 'مستأجر العقد', phone: '+96890000000', email: null, national_id: null },
    properties: { id: 'property-1', title: 'عقار العقد', address: 'مسقط' },
    units: { id: 'unit-1', unit_number: 'A-1', floor: '1', status: 'occupied', rent_amount: 1200 },
    renewed_from: null,
  };
}

describe('Contracts lifecycle mobile interactions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    deleteContractMock.mockImplementation((_id, options) => options?.onSuccess?.());
    renewContractMock.mockResolvedValue({ status: 'renewed', old_contract_id: 'contract-1', new_contract_id: 'contract-2' });
    terminateContractMock.mockResolvedValue({ status: 'terminated', contract_id: 'contract-1', cancelled_invoice_ids: [] });
    contractRows = [activeContract()];
    contractDetail = activeContract();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    document.body.innerHTML = '';
  });

  it('opens create, edit, detail, and delete confirmation from the contracts list mobile actions', async () => {
    await act(async () => root.render(<ContractsListPage />));

    const createButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('إنشاء عقد'));
    expect(createButton).toBeTruthy();
    await act(async () => createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('إنشاء عقد جديد');
    expect(document.body.textContent).toContain('العقار');
    expect(document.body.textContent).toContain('الوحدة');
    expect(document.body.textContent).toContain('المستأجر');

    const closeButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('إغلاق'));
    await act(async () => closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const editButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تعديل'));
    expect(editButton).toBeTruthy();
    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('تعديل عقد contract-1');

    const deleteButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('حذف'));
    expect(deleteButton).toBeTruthy();
    await act(async () => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('حذف العقد؟');
  });

  it('opens renew and terminate lifecycle dialogs from mobile-safe detail actions and invokes services', async () => {
    await act(async () => root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ContractDetailPage /></QueryClientProvider>));

    const renewButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تجديد العقد'));
    expect(renewButton).toBeTruthy();
    await act(async () => renewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('سيتم إنشاء عقد جديد');
    expect(document.body.textContent).toContain('اتفاقية المالك المغطية');

    const terminateButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('إنهاء العقد بسبب'));
    expect(terminateButton).toBeTruthy();
    await act(async () => terminateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('سبب الإنهاء');
    const reasonInput = document.body.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      valueSetter?.call(reasonInput, 'طلب المستأجر');
      reasonInput.dispatchEvent(new Event('input', { bubbles: true }));
      reasonInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const terminateSubmit = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('تأكيد الإنهاء'));
    await act(async () => terminateSubmit?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(terminateContractMock).toHaveBeenCalledWith('طلب المستأجر');
  });
});
