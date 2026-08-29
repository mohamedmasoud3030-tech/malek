import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useAllContracts } from '@/features/contracts/useContracts';
import type { Contract, Payment, Person, Property, Unit } from '@/types/domain';
import { getTodayLocalDateString, isValidDateInput } from '../financials-date-utils';
import { toFinancialNumber } from '../financialMath';
import { getInvoiceRemainingAmount, getInvoicePaymentValidationMessage } from '../invoices/invoice-payment-validation';
import { summarizeInvoices, type InvoiceStatusFilter } from '../invoices/invoiceService';
import { findNextCollectibleInvoiceId, getQuickCollectPreset, parseQuickCollectSearch } from '../invoices/quick-collect';
import { useGenerateInvoices, useInvoice, useInvoicesPaginated } from '../invoices/useInvoices';
import { getOrCreatePaymentRequestId, resetPaymentRequestId } from '../payments/paymentService';
import { usePostPayment } from '../payments/usePayments';
import { openReceiptPrintTab } from '../receipts/receipt-print';
import { useReceipt } from '../receipts/useReceipts';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentReadinessError, runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { InvoiceFilterOption } from '../components/invoice-filters';
import { exportInvoiceDocument as exportInvoiceDocumentPdf, printInvoiceDocument as printInvoiceDocumentAction } from '../invoices/invoice-actions';

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

const INVOICE_PAGE_SIZE = 20;

const MISSING_INVOICE_CONTEXT_MESSAGE =
  'تعذر إصدار مستند الفاتورة: بيانات العقد المرتبط بالفاتورة غير متاحة حالياً. يرجى إعادة المحاولة بعد اكتمال تحميل العقود.';

function normalizeLookup(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('ar') : '';
}

export function useInvoiceWorkspaceController() {
  const [status, setStatus] = useState<InvoiceStatusFilter>('unpaid');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [collectionSuccess, setCollectionSuccess] = useState<{
    receiptId: string;
    receiptNumber: string | null;
    amount: number;
    method: Payment['payment_method'];
  } | null>(null);
  const [collectionFocusKey, setCollectionFocusKey] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<Payment['payment_method']>('cash');
  const [paymentDate, setPaymentDate] = useState(() => getTodayLocalDateString());
  const [paymentReference, setPaymentReference] = useState('');
  const [isGenerateDialogOpen, setGenerateDialogOpen] = useState(false);
  const quickPaySubmitRef = useRef(false);
  const quickPayRequestIdRef = useRef<string | null>(null);

  // Invoice identity and document generation both need the same canonical
  // contract/tenant/property/unit context. The all-pages read prevents the
  // old 1000-row dropdown/search blind spot.
  const contractsQuery = useAllContracts('all', { enabled: true });
  const contractRows = contractsQuery.data?.rows ?? [];
  const normalizedSearch = normalizeLookup(invoiceSearch);
  const contextContractIds = useMemo(() => {
    if (!normalizedSearch) return [] as string[];
    return contractRows
      .filter((contract) => [
        contract.reference,
        contract.people?.full_name,
        contract.people?.phone,
        contract.properties?.title,
        contract.units?.unit_number,
      ].some((value) => normalizeLookup(value).includes(normalizedSearch)))
      .map((contract) => contract.id);
  }, [contractRows, normalizedSearch]);

  const invoicesQuery = useInvoicesPaginated({
    status,
    search: invoiceSearch,
    contextContractIds,
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
  const collectionReceiptQuery = useReceipt(collectionSuccess?.receiptId ?? '');
  const documentSettings = useDocumentSettings();
  const { authorization } = useAuth();

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
    () => (invoiceDetail ? getInvoiceRemainingAmount(invoiceDetail) : 0),
    [invoiceDetail],
  );
  const nextCollectibleInvoiceId = useMemo(
    () => findNextCollectibleInvoiceId(invoices, selectedInvoiceId || undefined),
    [invoices, selectedInvoiceId],
  );

  const rawAmountValue = Number(amount);
  const amountValue = toFinancialNumber(amount);
  const amountValidationMessage = useMemo(
    () => getInvoicePaymentValidationMessage({ amount, amountValue, invoiceDetail, paymentDate, rawAmountValue, selectedInvoiceId }),
    [amount, amountValue, invoiceDetail, paymentDate, rawAmountValue, selectedInvoiceId],
  );

  const hasAuthoritativeInvoiceList = !invoicesQuery.isError && !contractsQuery.isError;
  const hasAuthoritativeInvoiceDetail = hasAuthoritativeInvoiceList && !invoiceQuery.isError;
  const canGenerateInvoices = canAccess(authorization, financialOperationPermissions.generateInvoices) && hasAuthoritativeInvoiceList;
  const canCreatePayment = canAccess(authorization, financialOperationPermissions.createPayment) && hasAuthoritativeInvoiceDetail;
  const canExportInvoices = canAccess(authorization, financialOperationPermissions.exportInvoices) && hasAuthoritativeInvoiceList;
  const isPaymentDisabled = !canCreatePayment || quickPaySubmitRef.current || postPayment.isPending || remaining <= 0 || Boolean(amountValidationMessage);

  const canExportInvoiceDocuments = canExportInvoices && documentSettings.isReady;
  const canExportInvoiceDocument = canExportInvoiceDocuments && Boolean(
    invoiceDetail && contractRows.some((contract) => contract.id === invoiceDetail.contract_id),
  );

  const onConfirmGenerateInvoices = () => {
    if (!canGenerateInvoices || generate.isPending) return;
    generate.mutate(undefined, {
      onSuccess: () => setGenerateDialogOpen(false),
    });
  };

  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const deepLink = useMemo(() => parseQuickCollectSearch(search), [search]);
  const deepLinkInvoiceId = deepLink.invoiceId;
  const deepLinkCollectRequested = deepLink.collectRequested;
  const pendingDeepLinkCollectRef = useRef(false);

  useEffect(() => {
    if (!deepLinkInvoiceId) return;
    setSelectedInvoiceId(deepLinkInvoiceId);
    setCollectionSuccess(null);
    pendingDeepLinkCollectRef.current = deepLinkCollectRequested;
  }, [deepLinkInvoiceId, deepLinkCollectRequested]);

  useEffect(() => {
    if (!pendingDeepLinkCollectRef.current) return;
    if (!invoiceDetail || invoiceDetail.id !== deepLinkInvoiceId) return;
    pendingDeepLinkCollectRef.current = false;
    if (!canCreatePayment) return;
    const preset = getQuickCollectPreset(invoiceDetail);
    if (!preset) return;
    setAmount((current) => (current === '' ? preset.amount : current));
    setCollectionFocusKey((key) => key + 1);
  }, [invoiceDetail, deepLinkInvoiceId, canCreatePayment]);

  const onPostPayment = () => {
    if (!canCreatePayment || quickPaySubmitRef.current || postPayment.isPending) return;
    if (!selectedInvoiceId || !invoiceDetail || invoiceDetail.id !== selectedInvoiceId) return;

    const currentRemaining = getInvoiceRemainingAmount(invoiceDetail);
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
          setCollectionSuccess({
            receiptId: result.receipt_id,
            receiptNumber: result.receipt_no ?? null,
            amount: currentAmount,
            method: paymentMethod,
          });
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

  const onCollectInvoice = (invoiceId: string) => {
    setCollectionSuccess(null);
    setSelectedInvoiceId(invoiceId);
    if (!canCreatePayment) return;
    const row = invoices.find((candidate) => candidate.id === invoiceId);
    const preset = row ? getQuickCollectPreset(row) : null;
    if (preset) setAmount(preset.amount);
    setCollectionFocusKey((key) => key + 1);
  };

  const onCollectNextInvoice = () => {
    if (!nextCollectibleInvoiceId) return;
    onCollectInvoice(nextCollectibleInvoiceId);
  };

  const onPrintCollectionReceipt = () => {
    if (collectionSuccess?.receiptId) openReceiptPrintTab(collectionSuccess.receiptId);
  };

  const dismissCollectionSuccess = () => setCollectionSuccess(null);

  const onSelectInvoiceRow = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setCollectionSuccess(null);
  };

  const invoiceDocumentContext = (invoice: any) => {
    const contract = contractRows.find((candidate) => candidate.id === invoice.contract_id);
    return contract ? { settings: documentSettings.companySettings, ...contractContextForDocument(contract) } : null;
  };

  const exportInvoiceDocument = (invoice: any) => {
    void runGuardedDocumentAction({
      isReady: canExportInvoiceDocuments,
      operation: () => {
        const context = invoiceDocumentContext(invoice);
        if (!context) throw new DocumentReadinessError(MISSING_INVOICE_CONTEXT_MESSAGE);
        return exportInvoiceDocumentPdf(invoice, context);
      },
      fallbackMessage: 'تعذر تنزيل الفاتورة كملف PDF.',
    });
  };

  const printInvoiceDocument = (invoice: any) => {
    void runGuardedDocumentAction({
      isReady: canExportInvoiceDocuments,
      operation: () => {
        const context = invoiceDocumentContext(invoice);
        if (!context) throw new DocumentReadinessError(MISSING_INVOICE_CONTEXT_MESSAGE);
        return printInvoiceDocumentAction(invoice, context);
      },
      fallbackMessage: 'تعذرت طباعة الفاتورة.',
    });
  };

  const onExportInvoicePdf = () => {
    if (!invoiceDetail) return;
    exportInvoiceDocument(invoiceDetail);
  };

  const onPrintInvoice = (invoiceId: string) => {
    const invoice = invoices.find((candidate) => candidate.id === invoiceId);
    if (!invoice) return;
    printInvoiceDocument(invoice);
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
    amount,
    paymentMethod,
    paymentDate,
    paymentReference,
    isGenerateDialogOpen,
    invoicesQuery,
    invoiceQuery,
    generate,
    postPayment,
    collectionReceiptQuery,
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
    canExportInvoiceDocuments,
    isDocumentSettingsReady: documentSettings.isReady,
    isPaymentDisabled,
    canExportInvoiceDocument,
    collectionSuccess,
    collectionFocusKey,
    nextCollectibleInvoiceId,
    contractContextSearchTruncated: Boolean(contractsQuery.data?.truncated),
    onCollectInvoice,
    onCollectNextInvoice,
    onPrintCollectionReceipt,
    dismissCollectionSuccess,
    onSelectInvoiceRow,
    setGenerateDialogOpen,
    setSelectedInvoiceId,
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
