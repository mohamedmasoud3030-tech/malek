import { useMemo, useRef, useState } from 'react';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useContracts } from '@/features/contracts/useContracts';
import type { Contract, Payment, Person, Property, Unit } from '@/types/domain';
import { getTodayLocalDateString, isValidDateInput } from '../financials-date-utils';
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';
import { summarizeInvoices, type InvoiceStatusFilter, type InvoiceDetail } from '../invoices/invoiceService';
import { useGenerateInvoices, useInvoice, useInvoicesPaginated } from '../invoices/useInvoices';
import { getOrCreatePaymentRequestId, resetPaymentRequestId } from '../payments/paymentService';
import { usePostPayment } from '../payments/usePayments';
import { useReceipt, useReceipts } from '../receipts/useReceipts';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import type { InvoiceFilterOption } from '../components/invoice-filters';
import { exportInvoiceDocument as exportInvoiceDocumentPdf } from '../invoices/invoice-actions';

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

function contractContextForDocument(contract: any) {
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

export function useInvoiceWorkspaceController() {
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

  const invoicesQuery = useInvoicesPaginated({
    status,
    search: invoiceSearch,
    dateFrom,
    dateTo,
    tenantId,
    propertyId,
    page,
    pageSize: INVOICE_PAGE_SIZE,
  });
  const invoiceQuery = useInvoice(selectedInvoiceId);
  const generate = useGenerateInvoices();
  const postPayment = usePostPayment();
  const receiptsQuery = useReceipts({ limit: 10 });
  const receiptQuery = useReceipt(selectedReceiptId);
  const contractsQuery = useContracts({ status: 'all', page: 1, pageSize: 1000 });
  const companySettings = useCompanySettingsContract();
  const { authorization } = useAuth();

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

  const exportInvoiceDocument = (invoice: any) => {
    if (!canExportInvoices) return;

    const contract = contractsQuery.data?.rows.find((candidate) => candidate.id === invoice.contract_id);
    if (!contract) return;

    exportInvoiceDocumentPdf(invoice, {
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

  return {
    status,
    invoiceSearch,
    dateFrom,
    dateTo,
    tenantId,
    propertyId,
    page,
    selectedInvoiceId,
    selectedReceiptId,
    amount,
    paymentMethod,
    paymentDate,
    paymentReference,
    isGenerateDialogOpen,
    invoicesQuery,
    invoiceQuery,
    generate,
    postPayment,
    receiptsQuery,
    receiptQuery,
    tenantOptions,
    propertyOptions,
    invoices,
    summary,
    invoiceDetail,
    remaining,
    amountValidationMessage,
    canGenerateInvoices,
    canCreatePayment,
    canExportInvoices,
    isPaymentDisabled,
    canExportInvoiceDocument,
    setGenerateDialogOpen,
    setSelectedInvoiceId,
    setSelectedReceiptId,
    setAmount,
    setPaymentMethod,
    setPaymentDate,
    setPaymentReference,
    changeStatus,
    changeSearch,
    changeDateFrom,
    changeDateTo,
    changeTenant,
    changeProperty,
    setPage,
    onConfirmGenerateInvoices,
    onPostPayment,
    onExportInvoicePdf,
    onPrintInvoice,
    onExportInvoiceList,
    INVOICE_PAGE_SIZE,
  };
}
