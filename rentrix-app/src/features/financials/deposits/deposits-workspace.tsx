import { useMemo, useState } from 'react';
import { getContractStatusVariants } from '@/lib/contractStatus';
import { CheckCircle2, DollarSign, Download, FileCheck, MinusCircle, Printer, ShieldAlert, Wallet, Plus } from 'lucide-react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deductionReasonLabels,
  depositStatusLabels,
  listTenantDeposits,
  createTenantDeposit,
  recordDepositDeduction,
  recordDepositRefund,
  type DepositDeductionPayload,
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
        .select('id, tenant_id, property_id, unit_id, people:tenant_id(id,full_name), properties:property_id(id,title), units:unit_id(id,unit_number)')
        .is('deleted_at', null)
        .in('status', getContractStatusVariants('active') as Contract['status'][])
        .limit(100)
        .returns<DepositContractOption[]>();
      if (error) handleSupabaseError(error, 'تعذر تحميل العقود');
      return data ?? [];
    },
  });
}

function getDepositTone(status: DepositStatus): 'success' | 'info' | 'warning' {
  if (status === 'refunded') return 'success';
  if (status === 'held') return 'info';
  return 'warning';
}

function getContentStatus(isLoading: boolean, isError: boolean, isEmpty: boolean) {
  if (isLoading) return 'loading' as const;
  if (isError) return 'error' as const;
  if (isEmpty) return 'empty' as const;
  return 'ready' as const;
}

export function DepositsWorkspace() {
  const queryClient = useQueryClient();
  const [selectedDeposit, setSelectedDeposit] = useState<DepositRecord | null>(null);
  const [actionType, setActionType] = useState<'deduct' | 'refund' | 'create' | null>(null);
  const [amountInput, setAmountInput] = useState<number>(0);
  const [reasonInput, setReasonInput] = useState<DepositDeductionPayload['reason']>('maintenance_damage');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<DepositRefundPayload['payment_method']>('bank_transfer');
  const [createForm, setCreateForm] = useState({ contract_id: '', amount: 0, received_date: getTodayLocalDateString(), notes: '' });

  const depositsQuery = useQuery({
    queryKey: ['tenant-deposits'],
    queryFn: listTenantDeposits,
  });
  const contractsQuery = useContracts();
  const documentSettings = useDocumentSettings();
  const deposits = depositsQuery.data ?? [];
  const selectedContract = contractsQuery.data?.find((contract) => contract.id === createForm.contract_id) ?? null;
  const currencyCode = normalizeCurrency(documentSettings.companySettings.currency);
  const currencyLabel = documentSettings.companySettings.currencySymbol || currencyCode;
  const formatDepositMoney = (value: number) => formatCurrencyMoney({ amount: value, currency: currencyCode, locale: 'ar' });

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
      void queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل إنشاء الوديعة'),
  });

  const deductMut = useMutation({
    mutationFn: () => {
      if (!selectedDeposit) throw new Error('لا توجد وديعة محددة');
      return recordDepositDeduction({
        deposit_id: selectedDeposit.id,
        deduction_amount: amountInput,
        reason: reasonInput,
        description: descriptionInput,
        charged_date: getTodayLocalDateString(),
        request_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      toast.success('تم خصم مبلغ التأمين وتسجيل المصروف');
      setSelectedDeposit(null);
      setActionType(null);
      setAmountInput(0);
      setDescriptionInput('');
      void queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل الخصم - تحقق من الرصيد'),
  });

  const refundMut = useMutation({
    mutationFn: () => {
      if (!selectedDeposit) throw new Error('لا توجد وديعة محددة');
      return recordDepositRefund({
        deposit_id: selectedDeposit.id,
        refund_amount: amountInput,
        payment_method: paymentMethodInput,
        refund_date: getTodayLocalDateString(),
        notes: descriptionInput || null,
        request_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      toast.success('تم رد مبلغ التأمين');
      setSelectedDeposit(null);
      setActionType(null);
      setAmountInput(0);
      setDescriptionInput('');
      void queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل الاسترداد - تحقق من الرصيد'),
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

  const openDepositAction = (deposit: DepositRecord, type: 'deduct' | 'refund') => {
    setSelectedDeposit(deposit);
    setActionType(type);
    setAmountInput(deposit.remaining_amount);
    setDescriptionInput('');
  };

  const executeSelectedAction = () => {
    if (actionType === 'deduct') {
      deductMut.mutate();
      return;
    }
    refundMut.mutate();
  };

  const depositActions = (deposit: DepositRecord) => [
    { id: 'print', label: 'طباعة', icon: Printer, onClick: () => handlePrint(deposit), disabled: !documentSettings.isReady },
    { id: 'pdf', label: 'تنزيل PDF', icon: Download, onClick: () => handleDownloadPdf(deposit), disabled: !documentSettings.isReady },
    ...(deposit.remaining_amount > 0
      ? [
          { id: 'deduct', label: 'خصم ضرر', icon: ShieldAlert, onClick: () => openDepositAction(deposit, 'deduct') },
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

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-base font-bold tracking-tight">دفتر أمانات وتأمينات المستأجرين</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            مسار مالي حقيقي مع سجل غير قابل للتلاعب، منع تجاوز الرصيد، وقيود محاسبية.
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
                <Input required type="number" min="0.01" step="0.01" inputMode="decimal" dir="ltr" value={createForm.amount} onChange={(event) => setCreateForm((form) => ({ ...form, amount: Number(event.target.value) || 0 }))} />
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
        open={actionType === 'deduct' || actionType === 'refund'}
        onOpenChange={(open) => {
          if (!open && !deductMut.isPending && !refundMut.isPending) {
            setActionType(null);
            setSelectedDeposit(null);
          }
        }}
        title={actionType === 'deduct' ? 'خصم من وديعة التأمين' : 'رد وديعة التأمين'}
        description={selectedDeposit ? `المتبقي: ${formatDepositMoney(selectedDeposit.remaining_amount)} — لن يسمح النظام بتجاوز الرصيد` : undefined}
        visualVariant="operational"
      >
        <EntityForm.Root
          aria-busy={deductMut.isPending || refundMut.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount) return;
            if (actionType === 'deduct' && !descriptionInput.trim()) return;
            executeSelectedAction();
          }}
        >
          <EntityForm.ErrorSummary message={(deductMut.error as Error)?.message || (refundMut.error as Error)?.message} />
          <EntityForm.Section title="بيانات العملية">
            <EntityForm.Field label={`المبلغ (${currencyCode}) *`}>
              <Input required type="number" min="0.01" step="0.01" inputMode="decimal" dir="ltr" value={amountInput} onChange={(event) => setAmountInput(Number(event.target.value) || 0)} max={selectedDeposit?.remaining_amount} />
            </EntityForm.Field>
            {actionType === 'deduct' ? (
              <>
                <EntityForm.Field label="سبب الخصم *">
                  <Select required value={reasonInput} onChange={(event) => setReasonInput(event.target.value as DepositDeductionPayload['reason'])}>
                    {Object.entries(deductionReasonLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </Select>
                </EntityForm.Field>
                <EntityForm.Field label="وصف تفصيلي *" error={!descriptionInput.trim() ? 'الوصف مطلوب لتوثيق سبب الخصم.' : undefined}>
                  <Textarea required value={descriptionInput} onChange={(event) => setDescriptionInput(event.target.value)} placeholder="تفاصيل الأضرار..." />
                </EntityForm.Field>
              </>
            ) : (
              <>
                <EntityForm.Field label="طريقة الدفع *">
                  <Select required value={paymentMethodInput} onChange={(event) => setPaymentMethodInput(event.target.value as DepositRefundPayload['payment_method'])}>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقداً</option>
                    <option value="check">شيك</option>
                  </Select>
                </EntityForm.Field>
                <EntityForm.Field label="ملاحظات">
                  <Input value={descriptionInput} onChange={(event) => setDescriptionInput(event.target.value)} placeholder="ملاحظات الاسترداد..." />
                </EntityForm.Field>
              </>
            )}
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={deductMut.isPending || refundMut.isPending ? 'جارٍ التنفيذ...' : 'تأكيد العملية'}
            onCancel={() => { setActionType(null); setSelectedDeposit(null); }}
            isSubmitting={deductMut.isPending || refundMut.isPending}
            submitDisabled={
              amountInput <= 0
              || !selectedDeposit
              || amountInput > selectedDeposit.remaining_amount
              || (actionType === 'deduct' && !descriptionInput.trim())
            }
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}
