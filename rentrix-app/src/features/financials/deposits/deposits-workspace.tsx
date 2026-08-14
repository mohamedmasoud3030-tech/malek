import { useMemo, useState } from 'react';
import { getContractStatusVariants } from '@/lib/contractStatus';
import { CheckCircle2, DollarSign, Download, FileCheck, MinusCircle, Printer, ShieldAlert, Wallet, Plus, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { Input } from '@/components/ui/input';
import { FinanceKpiGrid, FinanceKpiCard } from '../components/finance-reporting-visual-foundations';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { AsyncContentState } from '@/components/async-content-state';
import { numberToArabicWords, getCurrencyWordConfig } from '@/lib/numberToArabicWords';
import { formatMoney as formatCurrencyMoney, formatLatinNumber, normalizeCurrency } from '@/lib/formatters';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  depositStatusLabels,
  depositClaimStatusLabels,
  depositClaimKindLabels,
  listTenantDeposits,
  createTenantDeposit,
  createDepositClaim,
  approveDepositClaim,
  rejectDepositClaim,
  applyDepositClaim,
  reverseDepositClaim,
  listDepositClaims,
  refundDepositGoverned,
  reverseDepositRefund,
  listDepositRefundEvents,
  type DepositClaimCreatePayload,
  type DepositClaimRecord,
  type DepositRefundEventRecord,
  type DepositRecord,
  type DepositRefundPayload,
  type DepositStatus,
} from './deposit-service';
import {
  describeSelectedContract,
  formatContractOptionLabel,
  formatDepositContractReference,
  type DepositContractOption,
} from './deposit-contract-options';
import type { Contract } from '@/types/domain';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

function useContracts() {
  return useQuery({
    queryKey: ['contracts-for-deposits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, tenant_id, property_id, unit_id, people:people!contracts_tenant_id_fkey(id,full_name), properties:properties!contracts_property_id_fkey(id,title), units:units!contracts_unit_id_fkey(id,unit_number)')
        .is('deleted_at', null)
        .in('status', getContractStatusVariants('active') as Contract['status'][])
        .limit(100)
        .returns<DepositContractOption[]>();
      if (error) handleSupabaseError(error, 'تعذر تحميل العقود');
      return data ?? [];
    },
  });
}

type InvoiceOption = { id: string; no: string; amount: number; paid_amount: number; status: string };

function useDepositInvoices(contractId?: string | null) {
  return useQuery({
    queryKey: ['deposit-invoices', contractId],
    enabled: Boolean(contractId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, no, amount, paid_amount, status')
        .eq('contract_id', contractId!)
        .is('deleted_at', null)
        .limit(100)
        .returns<InvoiceOption[]>();
      if (error) handleSupabaseError(error, 'تعذر تحميل فواتير العقد');
      return data ?? [];
    },
  });
}

function getDepositTone(status: DepositStatus): 'success' | 'info' | 'warning' {
  if (status === 'refunded') return 'success';
  if (status === 'held') return 'info';
  return 'warning';
}

function getClaimTone(status: DepositClaimRecord['status']): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'APPLIED' || status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'REVERSED') return 'warning';
  return 'info';
}

function getContentStatus(isLoading: boolean, isError: boolean, isEmpty: boolean) {
  if (isLoading) return 'loading' as const;
  if (isError) return 'error' as const;
  if (isEmpty) return 'empty' as const;
  return 'ready' as const;
}

export function DepositsWorkspace() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';
  const [selectedDeposit, setSelectedDeposit] = useState<DepositRecord | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<DepositClaimRecord | null>(null);
  const [selectedRefundEvent, setSelectedRefundEvent] = useState<DepositRefundEventRecord | null>(null);
  const [actionType, setActionType] = useState<'claim' | 'refund' | 'rejectClaim' | 'reverseClaim' | 'reverseRefund' | 'create' | null>(null);
  const [amountInput, setAmountInput] = useState<number>(0);
  const [claimKindInput, setClaimKindInput] = useState<DepositClaimCreatePayload['claim_kind']>('DAMAGE');
  const [invoiceInput, setInvoiceInput] = useState('');
  const [evidenceInput, setEvidenceInput] = useState('');
  const [claimNoteInput, setClaimNoteInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<DepositRefundPayload['payment_method']>('bank_transfer');
  const [createForm, setCreateForm] = useState({ contract_id: '', amount: 0, received_date: getTodayLocalDateString(), notes: '' });

  const depositsQuery = useQuery({
    queryKey: ['tenant-deposits'],
    queryFn: listTenantDeposits,
  });
  const claimsQuery = useQuery({
    queryKey: ['deposit-claims'],
    queryFn: () => listDepositClaims(),
  });
  const refundEventsQuery = useQuery({
    queryKey: ['deposit-refund-events'],
    queryFn: () => listDepositRefundEvents(),
  });
  const contractsQuery = useContracts();
  const invoicesQuery = useDepositInvoices(selectedDeposit?.contract_id);
  const documentSettings = useDocumentSettings();
  const deposits = depositsQuery.data ?? [];
  const claims = claimsQuery.data ?? [];
  const refundEvents = refundEventsQuery.data ?? [];
  const selectedContract = contractsQuery.data?.find((contract) => contract.id === createForm.contract_id) ?? null;
  const currencyCode = normalizeCurrency(documentSettings.companySettings.currency);
  const currencyLabel = documentSettings.companySettings.currencySymbol || currencyCode;
  const formatDepositMoney = (value: number) => formatCurrencyMoney({ amount: value, currency: currencyCode, locale: 'ar' });

  const invalidateFinancial = () => {
    void queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
    void queryClient.invalidateQueries({ queryKey: ['deposit-claims'] });
    void queryClient.invalidateQueries({ queryKey: ['deposit-refund-events'] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createTenantDeposit({
        contract_id: createForm.contract_id,
        amount: createForm.amount,
        received_date: createForm.received_date,
        notes: createForm.notes || null,
        request_id: crypto.randomUUID(),
      }),
    onSuccess: () => {
      toast.success('تم تسجيل وديعة التأمين بنجاح');
      setActionType(null);
      setCreateForm({ contract_id: '', amount: 0, received_date: getTodayLocalDateString(), notes: '' });
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل إنشاء الوديعة'),
  });

  const claimMut = useMutation({
    mutationFn: () => {
      if (!selectedDeposit) throw new Error('لا توجد وديعة محددة');
      return createDepositClaim({
        deposit_id: selectedDeposit.id,
        claim_kind: claimKindInput,
        invoice_id: claimKindInput === 'INVOICE_ARREARS' ? invoiceInput || null : null,
        allocation_amount: amountInput,
        evidence_uri: evidenceInput,
        claim_note: claimNoteInput || null,
        request_id: crypto.randomUUID(),
      });
    },
    onSuccess: (claim) => {
      toast.success('تم إنشاء طلب التخصيص — بانتظار اعتماد مدقق آخر');
      setSelectedDeposit(null);
      setActionType(null);
      setAmountInput(0);
      setEvidenceInput('');
      setClaimNoteInput('');
      setInvoiceInput('');
      void queryClient.invalidateQueries({ queryKey: ['deposit-claims'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل إنشاء الطلب'),
  });

  const approveMut = useMutation({
    mutationFn: (claim: DepositClaimRecord) => approveDepositClaim(claim.id),
    onSuccess: () => {
      toast.success('تم اعتماد الطلب');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل الاعتماد'),
  });

  const applyMut = useMutation({
    mutationFn: (claim: DepositClaimRecord) => applyDepositClaim(claim.id),
    onSuccess: () => {
      toast.success('تم تطبيق التخصيص على الحسابات والفواتير');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل تطبيق التخصيص'),
  });

  const rejectMut = useMutation({
    mutationFn: () => {
      if (!selectedClaim) throw new Error('لا يوجد طلب محدد');
      return rejectDepositClaim(selectedClaim.id, reasonInput);
    },
    onSuccess: () => {
      toast.success('تم رفض الطلب');
      setSelectedClaim(null);
      setActionType(null);
      setReasonInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل رفض الطلب'),
  });

  const reverseClaimMut = useMutation({
    mutationFn: () => {
      if (!selectedClaim) throw new Error('لا يوجد طلب محدد');
      return reverseDepositClaim(selectedClaim.id, reasonInput);
    },
    onSuccess: () => {
      toast.success('تم إلغاء التخصيص بقيد تعويضي');
      setSelectedClaim(null);
      setActionType(null);
      setReasonInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل إلغاء التخصيص'),
  });

  const refundMut = useMutation({
    mutationFn: () => {
      if (!selectedDeposit) throw new Error('لا توجد وديعة محددة');
      return refundDepositGoverned({
        deposit_id: selectedDeposit.id,
        refund_amount: amountInput,
        payment_method: paymentMethodInput,
        refund_date: getTodayLocalDateString(),
        notes: claimNoteInput || null,
        request_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      toast.success('تم رد مبلغ التأمين');
      setSelectedDeposit(null);
      setActionType(null);
      setAmountInput(0);
      setClaimNoteInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل الاسترداد - تحقق من الرصيد'),
  });

  const reverseRefundMut = useMutation({
    mutationFn: () => {
      if (!selectedRefundEvent) throw new Error('لا يوجد حدث استرداد محدد');
      return reverseDepositRefund(selectedRefundEvent.id, reasonInput);
    },
    onSuccess: () => {
      toast.success('تم إلغاء الاسترداد بقيد تعويضي');
      setSelectedRefundEvent(null);
      setActionType(null);
      setReasonInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل إلغاء الاسترداد'),
  });

  const totalHeld = useMemo(() => deposits.reduce((sum, deposit) => sum + deposit.remaining_amount, 0), [deposits]);
  const totalDeductions = useMemo(() => deposits.reduce((sum, deposit) => sum + deposit.deducted_amount, 0), [deposits]);
  const totalRefunded = useMemo(() => deposits.reduce((sum, deposit) => sum + deposit.refunded_amount, 0), [deposits]);
  const contentStatus = getContentStatus(depositsQuery.isLoading, depositsQuery.isError, deposits.length === 0);

  const buildDepositClearanceDocument = (deposit: DepositRecord) => {
    const printableAmount = deposit.remaining_amount > 0 ? deposit.remaining_amount : deposit.deposit_amount;
    const tafqeet = numberToArabicWords(printableAmount, getCurrencyWordConfig(currencyCode));
    const contractReference = formatDepositContractReference(deposit);
    return {
      reportTitle: 'سند تسوية ومخالصة مبلغ التأمين',
      reportType: 'Tenant_Security_Deposit_Clearance',
      periodFrom: deposit.received_date,
      periodTo: getTodayLocalDateString(),
      sections: [
        {
          title: 'بيانات الوديعة',
          rows: [
            { label: 'العقد', value: contractReference },
            { label: 'مبلغ التأمين الأصلي', value: `${deposit.deposit_amount} ${currencyLabel}` },
            { label: 'الخصومات', value: `${deposit.deducted_amount} ${currencyLabel}` },
            { label: 'المسترد', value: `${deposit.refunded_amount} ${currencyLabel}` },
            { label: 'المتبقي', value: `${deposit.remaining_amount} ${currencyLabel}` },
            { label: 'تفقيط المتبقي', value: tafqeet },
          ],
          totals: ['الصافي', `${deposit.remaining_amount} ${currencyLabel}`],
        },
      ],
      totalSummary: `تاريخ المخالصة: ${getTodayLocalDateString()}`,
    };
  };

  const handlePrint = (deposit: DepositRecord) => {
    // Guard inside the async boundary so the handler fails closed with a
    // visible Arabic reason rather than silently doing nothing.
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => {
        const report = buildDepositClearanceDocument(deposit) satisfies ReportDocumentData;
        return documentService.printDocument('generic_report', { settings: documentSettings.companySettings, payload: toReportDocumentPayload(report) });
      },
      fallbackMessage: 'تعذرت طباعة سند تسوية الوديعة.',
    });
  };

  const handleDownloadPdf = (deposit: DepositRecord) => {
    // Guard inside the async boundary so the handler fails closed with a
    // visible Arabic reason rather than silently doing nothing.
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => {
        const report = buildDepositClearanceDocument(deposit) satisfies ReportDocumentData;
        return documentService.downloadDocumentPdf('generic_report', { settings: documentSettings.companySettings, payload: toReportDocumentPayload(report) });
      },
      fallbackMessage: 'تعذر تنزيل سند تسوية الوديعة كملف PDF.',
    });
  };

  const openDepositAction = (deposit: DepositRecord, type: 'claim' | 'refund') => {
    setSelectedDeposit(deposit);
    setActionType(type);
    setAmountInput(deposit.remaining_amount);
    setClaimNoteInput('');
    setEvidenceInput('');
    setInvoiceInput('');
    setClaimKindInput('DAMAGE');
  };

  const depositActions = (deposit: DepositRecord) => [
    { id: 'print', label: 'طباعة', icon: Printer, onClick: () => handlePrint(deposit), disabled: !documentSettings.isReady },
    { id: 'pdf', label: 'تنزيل PDF', icon: Download, onClick: () => handleDownloadPdf(deposit), disabled: !documentSettings.isReady },
    ...(deposit.remaining_amount > 0
      ? [
          { id: 'claim', label: 'طلب تخصيص (بإثبات)', icon: ShieldAlert, onClick: () => openDepositAction(deposit, 'claim') },
          { id: 'refund', label: 'رد التأمين', icon: DollarSign, onClick: () => openDepositAction(deposit, 'refund') },
        ]
      : []),
  ];

  const columns: ColumnDef<DepositRecord>[] = [
    {
      key: 'contract',
      header: 'العقد والمستأجر',
      render: (deposit) => (
        <div className="min-w-0">
          <p className="font-bold">{formatDepositContractReference(deposit)}</p>
          {deposit.tenant_name ? <p className="mt-0.5 text-xs text-muted-foreground">{deposit.tenant_name}</p> : null}
        </div>
      ),
    },
    {
      key: 'received_date',
      header: 'تاريخ الاستلام',
      render: (deposit) => <span dir="ltr" className="tabular-nums">{deposit.received_date}</span>,
    },
    {
      key: 'original',
      header: 'الأصلي',
      render: (deposit) => <span dir="ltr" className="font-bold tabular-nums">{formatDepositMoney(deposit.deposit_amount)}</span>,
    },
    {
      key: 'deducted',
      header: 'المخصوم',
      render: (deposit) => <span dir="ltr" className="font-bold text-destructive tabular-nums">{formatDepositMoney(deposit.deducted_amount)}</span>,
    },
    {
      key: 'refunded',
      header: 'المسترد',
      render: (deposit) => <span dir="ltr" className="font-bold text-success tabular-nums">{formatDepositMoney(deposit.refunded_amount)}</span>,
    },
    {
      key: 'remaining',
      header: 'المتبقي',
      render: (deposit) => <span dir="ltr" className="font-black text-primary tabular-nums">{formatDepositMoney(deposit.remaining_amount)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (deposit) => <StatusBadge tone={getDepositTone(deposit.status)}>{depositStatusLabels[deposit.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (deposit) => <ActionMenu label={`إجراءات ${formatDepositContractReference(deposit)}`} items={depositActions(deposit)} />,
    },
  ];

  const claimColumns: ColumnDef<DepositClaimRecord>[] = [
    {
      key: 'claim',
      header: 'الطلب',
      render: (claim) => (
        <div className="min-w-0">
          <p className="font-bold">{depositClaimKindLabels[claim.claim_kind]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">{claim.evidence_uri}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (claim) => <span dir="ltr" className="font-bold tabular-nums">{formatDepositMoney(claim.allocation_amount)}</span>,
    },
    {
      key: 'target',
      header: 'الحساب',
      render: (claim) => <span className="tabular-nums">{claim.target_account_no ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (claim) => <StatusBadge tone={getClaimTone(claim.status)}>{depositClaimStatusLabels[claim.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (claim) => (
        <div className="flex flex-wrap items-center gap-1">
          {claim.status === 'PENDING' && claim.created_by !== currentUserId ? (
            <Button size="sm" variant="default" onClick={() => approveMut.mutate(claim)}>اعتماد</Button>
          ) : null}
          {claim.status === 'PENDING' && claim.created_by !== currentUserId ? (
            <Button size="sm" variant="outline" onClick={() => { setSelectedClaim(claim); setActionType('rejectClaim'); setReasonInput(''); }}>رفض</Button>
          ) : null}
          {claim.status === 'APPROVED' ? (
            <Button size="sm" variant="default" onClick={() => applyMut.mutate(claim)}>تطبيق</Button>
          ) : null}
          {claim.status === 'APPLIED' ? (
            <Button size="sm" variant="outline" onClick={() => { setSelectedClaim(claim); setActionType('reverseClaim'); setReasonInput(''); }}>
              <Undo2 className="size-3.5" /> إلغاء
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const refundColumns: ColumnDef<DepositRefundEventRecord>[] = [
    {
      key: 'refund',
      header: 'الاسترداد',
      render: (event) => <span dir="ltr" className="tabular-nums">{event.effective_date}</span>,
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (event) => <span dir="ltr" className="font-bold tabular-nums">{formatDepositMoney(event.amount)}</span>,
    },
    {
      key: 'account',
      header: 'الحساب النقدي',
      render: (event) => <span className="tabular-nums">{event.cash_account_no}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (event) => <StatusBadge tone={event.status === 'POSTED' ? 'success' : 'warning'}>{event.status === 'POSTED' ? 'مرحّل' : 'ملغى'}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (event) =>
        event.status === 'POSTED' ? (
          <Button size="sm" variant="outline" onClick={() => { setSelectedRefundEvent(event); setActionType('reverseRefund'); setReasonInput(''); }}>
            <Undo2 className="size-3.5" /> إلغاء الاسترداد
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-base font-bold tracking-tight">دفتر أمانات وتأمينات المستأجرين</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            مسار مالي حقيقي مع سجل غير قابل للتلاعب، منع تجاوز الرصيد، وقيود محاسبية. التخصيصات تتطلب طلباً
            مدعوماً بإثبات واعتماد مدقق (maker-checker)، والاستردادات تُرحَّل عبر قيود معيارية قابلة للإلغاء التعويضي،
            ولا يسمح النظام بكتابة محاسبية مباشرة من المتصفح.
          </p>
        </div>
        <Button onClick={() => setActionType('create')} className="min-h-11 gap-2 sm:shrink-0">
          <Plus className="size-4" />
          تسجيل وديعة جديدة
        </Button>
      </section>

      {!documentSettings.isReady && !documentSettings.isLoading ? <DocumentReadinessNotice /> : null}

      <FinanceKpiGrid desktopColumns={4} className="mb-2">
        <FinanceKpiCard label="الأمانات المحتجزة" value={formatDepositMoney(totalHeld)} icon={Wallet} accent="primary" sub="واجب الرد" unit={currencyCode} />
        <FinanceKpiCard label="الخصومات" value={formatDepositMoney(totalDeductions)} icon={MinusCircle} accent="primary" sub="أضرار وصيانة" unit={currencyCode} />
        <FinanceKpiCard label="المسترد" value={formatDepositMoney(totalRefunded)} icon={CheckCircle2} accent="primary" sub="تم رده" unit={currencyCode} />
        <FinanceKpiCard label="عدد الودائع" value={formatLatinNumber(deposits.length, 'ar')} icon={FileCheck} accent="primary" sub="سجلات" />
      </FinanceKpiGrid>

      <AsyncContentState
        status={contentStatus}
        error={depositsQuery.error as Error}
        errorTitle="تعذر تحميل الودائع"
        errorAction={<Button onClick={() => depositsQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد ودائع تأمين"
        emptyDescription="ابدأ بتسجيل وديعة تأمين مرتبطة بعقد نشط. سيتم حفظها عبر RPC ذري مع قيد محاسبي."
        emptyAction={<Button onClick={() => setActionType('create')}>تسجيل أول وديعة</Button>}
      >
        <EntityTable
          aria-label="جدول التأمينات"
          rows={deposits}
          columns={columns}
          keyOf={(deposit) => deposit.id}
          mobileVisibleSecondaryKey="remaining"
        />
      </AsyncContentState>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">طلبات تخصيص الودائع (إثبات + اعتماد مدقق)</h3>
          <Button size="sm" variant="ghost" onClick={() => claimsQuery.refetch()}>تحديث</Button>
        </div>
        {claims.length === 0 ? (
          <p className="rounded-xl bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
            لا توجد طلبات تخصيص. استخدم «طلب تخصيص (بإثبات)» من إجراءات الوديعة — يتطلب الطلب رابط إثبات، ثم اعتماد
            من مدقق مختلف، ثم تطبيقاً يرحّل القيد ويحدّث الفاتورة والميزان.
          </p>
        ) : (
          <EntityTable
            aria-label="جدول طلبات التخصيص"
            rows={claims}
            columns={claimColumns}
            keyOf={(claim) => claim.id}
            mobileVisibleSecondaryKey="status"
          />
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">أحداث رد الودائع (قابلة للإلغاء التعويضي)</h3>
          <Button size="sm" variant="ghost" onClick={() => refundEventsQuery.refetch()}>تحديث</Button>
        </div>
        {refundEvents.length === 0 ? (
          <p className="rounded-xl bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
            لا توجد أحداث رد بعد. يتم رد المبالغ عبر RPC موثوق يحدد الحساب النقدي من الخادم ويربط القيد بالسجل.
          </p>
        ) : (
          <EntityTable
            aria-label="جدول أحداث الرد"
            rows={refundEvents}
            columns={refundColumns}
            keyOf={(event) => event.id}
            mobileVisibleSecondaryKey="status"
          />
        )}
      </section>

      <EntityForm.Overlay
        open={actionType === 'create'}
        onOpenChange={(open) => { if (!open && !createMut.isPending) setActionType(null); }}
        title="تسجيل وديعة تأمين جديدة"
        description="يتم حفظ الوديعة عبر RPC ذري مع قيد محاسبي: مدين نقدية / دائن التزامات ودائع."
        visualVariant="operational"
      >
        <EntityForm.Root
          aria-busy={createMut.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!createForm.contract_id || createForm.amount <= 0 || !createForm.received_date) return;
            createMut.mutate();
          }}
        >
          <EntityForm.ErrorSummary message={createMut.isError ? (createMut.error as Error).message : undefined} />
          <EntityForm.Section title="بيانات الوديعة">
            <EntityForm.Field label="العقد النشط *">
              <Select required value={createForm.contract_id} onChange={(event) => setCreateForm((form) => ({ ...form, contract_id: event.target.value }))}>
                <option value="">اختر العقد</option>
                {contractsQuery.data?.map((contract) => (
                  <option key={contract.id} value={contract.id}>{formatContractOptionLabel(contract)}</option>
                ))}
              </Select>
            </EntityForm.Field>
            {selectedContract ? (
              <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium leading-5 text-muted-foreground">
                العقد المحدد: {describeSelectedContract(selectedContract)}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label={`المبلغ (${currencyCode}) *`}>
                <Input required type="number" min="0.001" step="0.001" inputMode="decimal" dir="ltr" value={createForm.amount} onChange={(event) => setCreateForm((form) => ({ ...form, amount: Number(event.target.value) || 0 }))} />
              </EntityForm.Field>
              <EntityForm.Field label="تاريخ الاستلام *">
                <Input required type="date" value={createForm.received_date} onChange={(event) => setCreateForm((form) => ({ ...form, received_date: event.target.value }))} />
              </EntityForm.Field>
            </div>
            <EntityForm.Field label="ملاحظات">
              <Input value={createForm.notes} onChange={(event) => setCreateForm((form) => ({ ...form, notes: event.target.value }))} placeholder="ملاحظات الاستلام..." />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={createMut.isPending ? 'جارٍ الحفظ...' : 'حفظ الوديعة'}
            onCancel={() => setActionType(null)}
            isSubmitting={createMut.isPending}
            submitDisabled={!createForm.contract_id || createForm.amount <= 0 || !createForm.received_date}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={actionType === 'claim'}
        onOpenChange={(open) => { if (!open && !claimMut.isPending) { setActionType(null); setSelectedDeposit(null); } }}
        title="طلب تخصيص من وديعة التأمين (بإثبات)"
        description={selectedDeposit ? `المتبقي: ${formatDepositMoney(selectedDeposit.remaining_amount)} — يُشتق الحساب الوجهة من العقد، ويحتاج الطلب اعتماد مدقق مختلف قبل التطبيق` : undefined}
        visualVariant="operational"
      >
        <EntityForm.Root
          aria-busy={claimMut.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount) return;
            if (!evidenceInput.trim()) return;
            if (claimKindInput === 'INVOICE_ARREARS' && !invoiceInput) return;
            claimMut.mutate();
          }}
        >
          <EntityForm.ErrorSummary message={claimMut.isError ? (claimMut.error as Error).message : undefined} />
          <EntityForm.Section title="بيانات الطلب">
            <EntityForm.Field label={`المبلغ (${currencyCode}) *`}>
              <Input required type="number" min="0.001" step="0.001" inputMode="decimal" dir="ltr" value={amountInput} onChange={(event) => setAmountInput(Number(event.target.value) || 0)} max={selectedDeposit?.remaining_amount} />
            </EntityForm.Field>
            <EntityForm.Field label="نوع الطلب *">
              <Select required value={claimKindInput} onChange={(event) => setClaimKindInput(event.target.value as DepositClaimCreatePayload['claim_kind'])}>
                {Object.entries(depositClaimKindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </Select>
            </EntityForm.Field>
            {claimKindInput === 'INVOICE_ARREARS' ? (
              <EntityForm.Field label="الفاتورة المفتوحة *">
                <Select required value={invoiceInput} onChange={(event) => setInvoiceInput(event.target.value)}>
                  <option value="">اختر الفاتورة</option>
                  {invoicesQuery.data
                    ?.filter((invoice) => invoice.amount + (invoice.paid_amount ?? 0) > 0)
                    .map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.no || invoice.id.slice(0, 8)} — {formatDepositMoney(invoice.amount)} (متبقي {formatDepositMoney(invoice.amount - (invoice.paid_amount ?? 0))})
                      </option>
                    ))}
                </Select>
              </EntityForm.Field>
            ) : null}
            <EntityForm.Field label="رابط / مرجع الإثبات *" error={!evidenceInput.trim() ? 'الإثبات مطلوب (رابط مستند أو مرجع).' : undefined}>
              <Input required value={evidenceInput} onChange={(event) => setEvidenceInput(event.target.value)} placeholder="evidence://… أو رابط مستند الإثبات" dir="ltr" />
            </EntityForm.Field>
            <EntityForm.Field label="ملاحظات">
              <Textarea value={claimNoteInput} onChange={(event) => setClaimNoteInput(event.target.value)} placeholder="تفاصيل التخصيص..." />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={claimMut.isPending ? 'جارٍ الإنشاء...' : 'إنشاء الطلب'}
            onCancel={() => { setActionType(null); setSelectedDeposit(null); }}
            isSubmitting={claimMut.isPending}
            submitDisabled={
              amountInput <= 0
              || !selectedDeposit
              || amountInput > selectedDeposit.remaining_amount
              || !evidenceInput.trim()
              || (claimKindInput === 'INVOICE_ARREARS' && !invoiceInput)
            }
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={actionType === 'refund'}
        onOpenChange={(open) => { if (!open && !refundMut.isPending) { setActionType(null); setSelectedDeposit(null); } }}
        title="رد وديعة التأمين"
        description={selectedDeposit ? `المتبقي: ${formatDepositMoney(selectedDeposit.remaining_amount)} — لن يسمح النظام بتجاوز الرصيد` : undefined}
        visualVariant="operational"
      >
        <EntityForm.Root
          aria-busy={refundMut.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount) return;
            refundMut.mutate();
          }}
        >
          <EntityForm.ErrorSummary message={refundMut.isError ? (refundMut.error as Error).message : undefined} />
          <EntityForm.Section title="بيانات الاسترداد">
            <EntityForm.Field label={`المبلغ (${currencyCode}) *`}>
              <Input required type="number" min="0.001" step="0.001" inputMode="decimal" dir="ltr" value={amountInput} onChange={(event) => setAmountInput(Number(event.target.value) || 0)} max={selectedDeposit?.remaining_amount} />
            </EntityForm.Field>
            <EntityForm.Field label="طريقة الدفع *">
              <Select required value={paymentMethodInput} onChange={(event) => setPaymentMethodInput(event.target.value as DepositRefundPayload['payment_method'])}>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="cash">نقداً</option>
                <option value="check">شيك</option>
              </Select>
            </EntityForm.Field>
            <EntityForm.Field label="ملاحظات">
              <Input value={claimNoteInput} onChange={(event) => setClaimNoteInput(event.target.value)} placeholder="ملاحظات الاسترداد..." />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={refundMut.isPending ? 'جارٍ التنفيذ...' : 'تأكيد الرد'}
            onCancel={() => { setActionType(null); setSelectedDeposit(null); }}
            isSubmitting={refundMut.isPending}
            submitDisabled={amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={actionType === 'rejectClaim' || actionType === 'reverseClaim' || actionType === 'reverseRefund'}
        onOpenChange={(open) => { if (!open && !rejectMut.isPending && !reverseClaimMut.isPending && !reverseRefundMut.isPending) { setActionType(null); setSelectedClaim(null); setSelectedRefundEvent(null); } }}
        title={actionType === 'rejectClaim' ? 'رفض طلب التخصيص' : actionType === 'reverseClaim' ? 'إلغاء التخصيص (قيد تعويضي)' : 'إلغاء الاسترداد (قيد تعويضي)'}
        description="الإلغاء لا يحذف السجل؛ يرحّل قيداً تعويضياً معاكساً ويستعيد الميزان والفاتورة تلقائياً."
        visualVariant="operational"
      >
        <EntityForm.Root
          aria-busy={rejectMut.isPending || reverseClaimMut.isPending || reverseRefundMut.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!reasonInput.trim()) return;
            if (actionType === 'rejectClaim') rejectMut.mutate();
            else if (actionType === 'reverseClaim') reverseClaimMut.mutate();
            else reverseRefundMut.mutate();
          }}
        >
          <EntityForm.ErrorSummary
            message={(rejectMut.error as Error)?.message || (reverseClaimMut.error as Error)?.message || (reverseRefundMut.error as Error)?.message}
          />
          <EntityForm.Section title="السبب">
            <EntityForm.Field label="السبب *" error={!reasonInput.trim() ? 'السبب مطلوب (3 أحرف على الأقل).' : undefined}>
              <Textarea required value={reasonInput} onChange={(event) => setReasonInput(event.target.value)} placeholder="سبب الرفض / الإلغاء..." />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel="تأكيد"
            onCancel={() => { setActionType(null); setSelectedClaim(null); setSelectedRefundEvent(null); }}
            isSubmitting={rejectMut.isPending || reverseClaimMut.isPending || reverseRefundMut.isPending}
            submitDisabled={!reasonInput.trim()}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}
