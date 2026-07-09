import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractDetailPage } from './ContractDetailPage';

vi.mock('../settings/useCompanySettings', async () => {
  const { testCompanySettingsContract } = await import('../../test/companySettingsContractMock');

  return { useCompanySettingsContract: () => testCompanySettingsContract };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to }: Readonly<{ children: React.ReactNode; params?: { contractId?: string }; to: string }>) => {
    const href = params?.contractId ? `/contracts/${params.contractId}` : to;
    return <a href={href}>{children}</a>;
  },
  useNavigate: () => vi.fn(),
  useParams: () => ({ contractId: 'contract-1' }),
}));

const contractsMocks = vi.hoisted(() => ({
  contractQuery: { data: null as unknown, error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  paymentsQuery: { data: null as unknown, error: null as Error | null, isError: false, isLoading: false, refetch: vi.fn() },
  renewMutation: { isPending: false, mutateAsync: vi.fn() },
  terminateMutation: { isPending: false, mutateAsync: vi.fn() },
}));

vi.mock('./useContracts', () => ({
  useContract: () => contractsMocks.contractQuery,
  useRenewContract: () => contractsMocks.renewMutation,
  useTerminateContract: () => contractsMocks.terminateMutation,
}));

vi.mock('./useContractPayments', () => ({
  useContractPayments: () => contractsMocks.paymentsQuery,
}));

vi.mock('./useContractDocuments', () => ({
  useContractDocuments: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useUploadContractDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteContractDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));

function expectMarkupToContain(html: string, snippets: readonly string[]) {
  snippets.forEach((snippet) => {
    expect(html).toContain(snippet);
  });
}

const contractDetail = {
  id: 'contract-1',
  property_id: 'property-1',
  unit_id: 'unit-1',
  tenant_id: 'tenant-1',
  renewed_from_id: null,
  start_date: '2026-05-01',
  end_date: '2027-04-30',
  rent_amount: 1234.5,
  payment_cycle: 'monthly',
  status: 'active',
  notes: null,
  cancellation_reason: null,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-02T00:00:00.000Z',
  deleted_at: null,
  people: { id: 'tenant-1', full_name: 'مستأجر الاختبار', phone: null, email: null, national_id: null },
  properties: { id: 'property-1', title: 'عقار الاختبار', address: 'مسقط' },
  renewed_from: null,
  units: { id: 'unit-1', unit_number: 'A-1', floor: '1', status: 'occupied', rent_amount: 1234.5 },
};

const contractPaymentsSnapshot = {
  invoices: [{
    id: 'invoice-1',
    issue_date: '2026-05-01',
    due_date: '2026-05-31',
    amount: 1234.5,
    paid_amount: 500,
    remaining_amount: 734.5,
    status: 'partial',
    notes: null,
    payments: [{
      id: 'payment-1',
      invoice_id: 'invoice-1',
      invoice_status: 'partial',
      invoice_due_date: '2026-05-31',
      payment_date: '2026-05-10',
      amount: 500,
      payment_method: 'bank_transfer',
      reference_number: 'BANK-REF-1',
      receipt_reference: 'REC-payment-',
    }],
  }],
  payments: [{
    id: 'payment-1',
    invoice_id: 'invoice-1',
    invoice_status: 'partial',
    invoice_due_date: '2026-05-31',
    payment_date: '2026-05-10',
    amount: 500,
    payment_method: 'bank_transfer',
    reference_number: 'BANK-REF-1',
    receipt_reference: 'REC-payment-',
  }],
  summary: { invoiceCount: 1, paymentCount: 1, totalInvoiced: 1234.5, totalPaid: 500, totalRemaining: 734.5 },
};

describe('ContractDetailPage load and money states', () => {
  beforeEach(() => {
    contractsMocks.contractQuery.data = contractDetail;
    contractsMocks.contractQuery.error = null;
    contractsMocks.contractQuery.isError = false;
    contractsMocks.contractQuery.isLoading = false;
    contractsMocks.paymentsQuery.data = contractPaymentsSnapshot;
    contractsMocks.paymentsQuery.error = null;
    contractsMocks.paymentsQuery.isError = false;
    contractsMocks.paymentsQuery.isLoading = false;
  });

  it('renders rent with centralized currency context', () => {
    const html = renderToStaticMarkup(<ContractDetailPage />);

    expectMarkupToContain(html, ['OMR', 'مستأجر الاختبار', 'A-1']);
  });

  it('renders contract-scoped financial and lifecycle timeline context', () => {
    const html = renderToStaticMarkup(<ContractDetailPage />);

    expectMarkupToContain(html, [
      'إجراءات التجديد والإنهاء',
      'إنهاء العقد بسبب',
      'لا يوجد عقد سابق مرتبط بهذا العقد',
      'سبب الإلغاء',
      'الخط الزمني المالي',
      'دورة السداد',
      'شهري',
      'الحالة',
      'آخر تعديل محفوظ على بيانات العقد',
      'تبويب مدفوعات العقد',
      'قراءة فقط',
      'عرض قراءة فقط للفواتير والدفعات ومراجع الإيصالات المرتبطة بهذا العقد فقط',
      'إجمالي المدفوع',
      'REC-payment-',
      'BANK-REF-1',
      'تحويل بنكي',
    ]);
  });

  it('renders a retryable error state when contract detail loading fails', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    contractsMocks.contractQuery.data = null;
    contractsMocks.contractQuery.error = new Error('تعذر تحميل عقد الاختبار');
    contractsMocks.contractQuery.isError = true;

    const html = renderToStaticMarkup(<ContractDetailPage />);

    expectMarkupToContain(html, ['تعذر تحميل العقد', 'إعداد الاتصال بقاعدة البيانات غير مكتمل.', 'إعادة المحاولة']);
  });
});
