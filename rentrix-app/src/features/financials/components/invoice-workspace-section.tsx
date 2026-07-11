import { useMemo, useRef, useState } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useContracts } from '@/features/contracts/useContracts';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { exportInvoiceToPdf } from '@/services/pdfService';
import type { Contract, Invoice, Payment, Person, Property, Unit } from '@/types/domain';
import { getTodayLocalDateString, isValidDateInput } from '../financials-date-utils';
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';
import { summarizeInvoices, type InvoiceDetail, type InvoiceStatusFilter } from '../invoices/invoiceService';
import { useGenerateInvoices, useInvoice, useInvoicesPaginated } from '../invoices/useInvoices';
import { getOrCreatePaymentRequestId, resetPaymentRequestId } from '../payments/paymentService';
import { usePostPayment } from '../payments/usePayments';
import { useReceipt, useReceipts } from '../receipts/useReceipts';
import { InvoiceDetailSection } from './invoice-detail-section';
import { type InvoiceFilterOption } from './invoice-filters';
import { InvoiceListSection } from './invoice-list-section';
import { ReceiptsSection } from './receipts-section';

type GenerateInvoicesDialogProps = {
  open: boolean;
  isGenerating: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function GenerateInvoicesDialog({ open, isGenerating, onOpenChange, onConfirm }: GenerateInvoicesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isGenerating) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-6" aria-hidden="true" />
            </span>
            <div className="space-y-2">
              <DialogTitle>توليد فواتير العقود النشطة</DialogTitle>
              <DialogDescription>
                سيبحث النظام عن العقود النشطة التي تحتاج فواتير دورية وينشئ الفواتير الناقصة فقط.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm font-black">قبل المتابعة</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>راجع العقود النشطة وتواريخ الاستحقاق قبل تشغيل التوليد.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>لن يتم تسجيل أي دفعات أو إيصالات من هذه الخطوة.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>بعد التوليد سيتم تحديث الفواتير ولوحات الملخص تلقائياً.</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>هذه عملية مالية جماعية. استخدمها عند جاهزية العقود النشطة للمراجعة الشهرية.</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              إلغاء
            </Button>
            <Button className="min-h-12" onClick={onConfirm} disabled={isGenerating}>
              {isGenerating ? 'جارٍ توليد الفواتير...' : 'تأكيد توليد الفواتير'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getAmountValidationMessage({
  amount,
  amountValue,
  invoiceDetail,
  paymentDate,
  rawAmountValue,
  selectedInvoiceId,
}: Readonly<{
  amount: string;
  amountValue: number;
  invoiceDetail: InvoiceDetail | undefined;
  paymentDate: string;
  rawAmountValue: number;
  selectedInvoiceId: string;
}>) {
  if (!selectedInvoiceId || !invoiceDetail || invoiceDetail.id !== selectedInvoiceId) return 'اختر فاتورة صالحة أولاً';
  if (!amount.trim()) return 'المبلغ مطلوب';
  if (!Number.isFinite(rawAmountValue)) return 'المبلغ يجب أن يكون رقماً صالحاً';
  if (amountValue <= 0) return 'المبلغ يجب أن يكون أكبر من صفر';
  if (amountValue > getSafeRemainingAmount(invoiceDetail.amount, invoiceDetail.paid_amount)) return 'المبلغ يجب ألا يتجاوز الرصيد المتبقي';
  if (!paymentDate) return 'تاريخ الدفع مطلوب';
  if (!isValidDateInput(paymentDate)) return 'تاريخ الدفع غير صالح';
  return '';
}

const nowIso = () => new Date().toISOString();

function contractContextForDocument(contract: ContractListItem) {
  const tenant: Person | null = contract.people
    ? { ...contract.people, type: 'tenant', address: null, notes: null, created_at: nowIso(), updated_at: nowIso(), deleted_at: null }
    : null;
  const unit: Unit | null = contract.units
    ? { ...contract.units, name: null, property_id: contract.property_id, notes: null, created_at: nowIso(), updated_at: nowIso(), deleted_at: null }
    : null;
  const property: Property | null = contract.properties
    ? { ...contract.properties, type: 'residential', owner_name: null, purchase_value: null, current_value: null, status: 'active', notes: null, created_at: nowIso(), updated_at: nowIso(), deleted_at: null }
    : null;

  return {
    contracts: [contract as Contract],
    tenants: tenant ? [tenant] : [],
    units: unit ? [unit] : [],
    properties: property ? [property] : [],
  };
}

const INVOICE_PAGE_SIZE = 10;

export function InvoiceWorkspaceSection() {
  const [status, setStatus] = useState<InvoiceStatusFilter>('unpaid');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Payment['payment_method']>('cash');
  const [paymentDate, setPaymentDate] = useState(() => getTodayLocalDateString());
  const [paymentReference, setPaymentReference] = useState('');
  const [isGenerateDialogOpen, setGenerateDialogOpen] = useState(false);
  const quickPaySubmitRef = useRef(false);
  const quickPayRequestIdRef = useRef<string | null>(null);

  const invoicesQuery = useInvoicesPaginated({ status, search: invoiceSearch, dateFrom, dateTo, tenantId, propertyId, page, pageSize: INVOICE_PAGE_SIZE });
  const invoiceQuery = useInvoice(selectedInvoiceId);
  const generate = useGenerateInvoices();
  const postPayment = usePostPayment();
  const receiptsQuery = useReceipts({ limit: 10 });
  const receiptQuery = useReceipt(selectedReceiptId);
  const contractsQuery = useContracts({ status: 'all', page: 1, pageSize: 1000 });
  const contractRows = contractsQuery.data?.rows ?? [];
  const tenantOptions = useMemo<InvoiceFilterOption[]>(() => {
    const map = new Map<string, string>();
    for (const contract of contractRows) {
      if (contract.tenant_id && contract.people?.full_name) map.set(contract.tenant_id, contract.people.full_name);
    }
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  }, [contractRows]);
  const propertyOptions = useMemo<InvoiceFilterOption[]>(() => {
    const map = new Map<string, string>();
    for (const contract of contractRows) {
      if (contract.property_id && contract.properties?.title) map.set(contract.property_id, contract.properties.title);
    }
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  }, [contractRows]);

  const resetPage = () => setPage(1);
  const changeStatus = (next: InvoiceStatusFilter) => { setStatus(next); resetPage(); };
  const changeSearch = (next: string) => { setInvoiceSearch(next); resetPage(); };
  const changeDateFrom = (next: string) => { setDateFrom(next); resetPage(); };
  const changeDateTo = (next: string) => { setDateTo(next); resetPage(); };
  const changeTenant = (next: string) => { setTenantId(next); resetPage(); };
  const changeProperty = (next: string) => { setPropertyId(next); resetPage(); };
  const companySettings = useCompanySettingsContract();
  const { authorization } = useAuth();

  const invoices = invoicesQuery.data?.rows ?? [];
  const summary = useMemo(() => summarizeInvoices(invoices), [invoices]);
  const invoiceDetail = invoiceQuery.data;
  const remaining = useMemo(
    () => (invoiceDetail ? getSafeRemainingAmount(invoiceDetail.amount, invoiceDetail.paid_amount) : 0),
    [invoiceDetail],
  );
  const rawAmountValue = Number(amount);
  const amountValue = toFinancialNumber(amount);
  const amountValidationMessage = useMemo(
    () => getAmountValidationMessage({ amount, amountValue, invoiceDetail, paymentDate, rawAmountValue, selectedInvoiceId }),
    [amount, amountValue, invoiceDetail, paymentDate, rawAmountValue, selectedInvoiceId],
  );
  const canGenerateInvoices = canAccess(authorization, financialOperationPermissions.generateInvoices);
  const canCreatePayment = canAccess(authorization, financialOperationPermissions.createPayment);
  const canExportInvoices = canAccess(authorization, financialOperationPermissions.exportInvoices);
  const isPaymentDisabled = !canCreatePayment || quickPaySubmitRef.current || postPayment.isPending || remaining <= 0 || Boolean(amountValidationMessage);
  const pdfSettings = {
    general: { company: { name: companySettings.companyName } },
    operational: { currency: companySettings.defaultCurrency },
  };
  const canExportInvoiceDocument = canExportInvoices && Boolean(
    invoiceDetail && contractsQuery.data?.rows.some((contract) => contract.id === invoiceDetail.contract_id),
  );

  const onConfirmGenerateInvoices = () => {
    if (!canGenerateInvoices || generate.isPending) return;
    generate.mutate(undefined, {
      onSuccess: () => setGenerateDialogOpen(false),
    });
  };

  const onPostPayment = () => {
    if (!canCreatePayment || quickPaySubmitRef.current || postPayment.isPending) return;
    if (!selectedInvoiceId || !invoiceDetail || invoiceDetail.id !== selectedInvoiceId) return;

    const currentRemaining = getSafeRemainingAmount(invoiceDetail.amount, invoiceDetail.paid_amount);
    const currentRawAmount = Number(amount);
    const currentAmount = toFinancialNumber(amount);

    if (!amount.trim() || !Number.isFinite(currentRawAmount) || currentAmount <= 0 || currentAmount > currentRemaining || !isValidDateInput(paymentDate)) return;

    quickPaySubmitRef.current = true;
    const requestId = getOrCreatePaymentRequestId(quickPayRequestIdRef);
    postPayment.mutate(
      {
        invoice_id: invoiceDetail.id,
        amount: currentAmount,
        method: paymentMethod,
        date: paymentDate,
        reference: paymentReference.trim() ? paymentReference.trim() : null,
        request_id: requestId,
      },
      {
        onSuccess: (result) => {
          setSelectedReceiptId(result.receipt_id);
          setAmount('');
          setPaymentReference('');
          resetPaymentRequestId(quickPayRequestIdRef);
        },
        onSettled: () => {
          quickPaySubmitRef.current = false;
        },
      },
    );
  };

  const exportInvoiceDocument = (invoice: Invoice) => {
    if (!canExportInvoices) return;

    const contract = contractsQuery.data?.rows.find((candidate) => candidate.id === invoice.contract_id);
    if (!contract) return;

    exportInvoiceToPdf(invoice, {
      settings: pdfSettings,
      ...contractContextForDocument(contract),
    });
  };

  const onExportInvoicePdf = () => {
    if (!invoiceDetail) return;
    exportInvoiceDocument(invoiceDetail);
  };

  const onPrintInvoice = (invoiceId: string) => {
    const invoice = invoices.find((candidate) => candidate.id === invoiceId);
    if (!invoice) return;

    exportInvoiceDocument(invoice);
  };

  const onExportInvoiceList = (invoiceId: string) => {
    const invoice = invoices.find((candidate) => candidate.id === invoiceId);
    if (!invoice) return;

    exportInvoiceDocument(invoice);
  };

  return (
    <>
      <InvoiceListSection
        summary={summary}
        status={status}
        invoiceSearch={invoiceSearch}
        invoices={invoices}
        selectedInvoiceId={selectedInvoiceId}
        isLoading={invoicesQuery.isLoading}
        isError={invoicesQuery.isError}
        error={invoicesQuery.error}
        isGenerating={generate.isPending}
        canGenerateInvoices={canGenerateInvoices}
        hasInvoiceFilter={status !== 'all' || invoiceSearch.trim().length > 0 || Boolean(dateFrom) || Boolean(dateTo) || Boolean(tenantId) || Boolean(propertyId)}
        dateFrom={dateFrom}
        dateTo={dateTo}
        tenantId={tenantId}
        propertyId={propertyId}
        tenantOptions={tenantOptions}
        propertyOptions={propertyOptions}
        page={page}
        pageSize={INVOICE_PAGE_SIZE}
        total={invoicesQuery.data?.total ?? 0}
        onStatusChange={changeStatus}
        onInvoiceSearchChange={changeSearch}
        onGenerateInvoices={() => {
          if (canGenerateInvoices) setGenerateDialogOpen(true);
        }}
        onSelectInvoice={setSelectedInvoiceId}
        onPrintInvoice={canExportInvoices ? onPrintInvoice : undefined}
        onExportInvoice={canExportInvoices ? onExportInvoiceList : undefined}
        onDateFromChange={changeDateFrom}
        onDateToChange={changeDateTo}
        onTenantChange={changeTenant}
        onPropertyChange={changeProperty}
        onPageChange={setPage}
      />

      <GenerateInvoicesDialog
        open={isGenerateDialogOpen}
        isGenerating={generate.isPending}
        onOpenChange={setGenerateDialogOpen}
        onConfirm={onConfirmGenerateInvoices}
      />

      <InvoiceDetailSection
        selectedInvoiceId={selectedInvoiceId}
        invoiceDetail={invoiceDetail}
        remaining={remaining}
        isLoading={invoiceQuery.isLoading}
        isError={invoiceQuery.isError}
        error={invoiceQuery.error}
        amount={amount}
        method={paymentMethod}
        paymentDate={paymentDate}
        reference={paymentReference}
        amountValidationMessage={canCreatePayment ? amountValidationMessage : 'ليس لديك صلاحية تسجيل دفعة مالية.'}
        isPaymentPending={postPayment.isPending}
        isPaymentDisabled={isPaymentDisabled}
        onAmountChange={setAmount}
        onMethodChange={setPaymentMethod}
        onPaymentDateChange={setPaymentDate}
        onReferenceChange={setPaymentReference}
        onPostPayment={onPostPayment}
        onExportPdf={canExportInvoiceDocument ? onExportInvoicePdf : undefined}
      />

      <ReceiptsSection
        receipts={receiptsQuery.data ?? []}
        selectedReceiptId={selectedReceiptId}
        receiptDetail={receiptQuery.data}
        isReceiptsLoading={receiptsQuery.isLoading}
        isReceiptsError={receiptsQuery.isError}
        receiptsError={receiptsQuery.error}
        isReceiptDetailLoading={receiptQuery.isLoading}
        isReceiptDetailError={receiptQuery.isError}
        receiptDetailError={receiptQuery.error}
        onSelectReceipt={setSelectedReceiptId}
      />
    </>
  );
}