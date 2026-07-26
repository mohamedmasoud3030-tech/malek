import { useMemo, useState } from 'react';
import { getContractStatusVariants } from '@/lib/contractStatus';
import { CheckCircle2, DollarSign, Download, FileCheck, MinusCircle, Printer, ShieldAlert, Wallet, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { AsyncContentState } from '@/components/async-content-state';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { numberToArabicWords, OMR_CURRENCY_CONFIG } from '@/lib/numberToArabicWords';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
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
import type { Contract } from '@/types/domain';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

const defaultSettings: DocumentSettings = {
  company: { name: 'رينتريكس لإدارة العقارات', address: 'سلطنة عمان - مسقط', phone: '+968 24000000' },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

function useContracts() {
  return useQuery({
    queryKey: ['contracts-for-deposits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, tenant_id, property_id, unit_id')
        .is('deleted_at', null)
        .in('status', getContractStatusVariants('active') as Contract['status'][]) // legacy rows may be stored as 'ACTIVE'
        .limit(100)
        .returns<Contract[]>();
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
  const deposits = depositsQuery.data ?? [];

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
      queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
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
      queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
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
      queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل الاسترداد - تحقق من الرصيد'),
  });

  const totalHeld = useMemo(() => deposits.reduce((sum, deposit) => sum + deposit.remaining_amount, 0), [deposits]);
  const totalDeductions = useMemo(() => deposits.reduce((sum, deposit) => sum + deposit.deducted_amount, 0), [deposits]);
  const totalRefunded = useMemo(() => deposits.reduce((sum, deposit) => sum + deposit.refunded_amount, 0), [deposits]);
  const contentStatus = getContentStatus(depositsQuery.isLoading, depositsQuery.isError, deposits.length === 0);

  const buildDepositClearanceDocument = (deposit: DepositRecord) => {
    const printableAmount = deposit.remaining_amount > 0 ? deposit.remaining_amount : deposit.deposit_amount;
    const tafqeet = numberToArabicWords(printableAmount, OMR_CURRENCY_CONFIG);
    return {
      reportTitle: 'سند تسوية ومخالصة مبلغ التأمين',
      reportType: 'Tenant_Security_Deposit_Clearance',
      periodFrom: deposit.received_date,
      periodTo: getTodayLocalDateString(),
      sections: [
        {
          title: 'بيانات الوديعة',
          rows: [
            { label: 'معرف العقد', value: deposit.contract_id },
            { label: 'مبلغ التأمين الأصلي', value: `${deposit.deposit_amount} ر.ع` },
            { label: 'الخصومات', value: `${deposit.deducted_amount} ر.ع` },
            { label: 'المسترد', value: `${deposit.refunded_amount} ر.ع` },
            { label: 'المتبقي', value: `${deposit.remaining_amount} ر.ع` },
            { label: 'تفقيط المتبقي', value: tafqeet },
          ],
          totals: ['الصافي', `${deposit.remaining_amount} ر.ع`],
        },
      ],
      totalSummary: `تاريخ المخالصة: ${getTodayLocalDateString()}`,
    };
  };

  const handlePrint = (deposit: DepositRecord) => {
    void DocumentTemplates.printReportDocument(buildDepositClearanceDocument(deposit), defaultSettings);
  };

  const handleDownloadPdf = (deposit: DepositRecord) => {
    void DocumentTemplates.downloadReportPdf(buildDepositClearanceDocument(deposit), defaultSettings);
  };

  const executeSelectedAction = () => {
    if (actionType === 'deduct') {
      deductMut.mutate();
      return;
    }
    refundMut.mutate();
  };

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

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="الأمانات المحتجزة" value={formatMoney(totalHeld)} icon={Wallet} accent="primary" sub="واجب الرد" />
        <KpiCard label="الخصومات" value={formatMoney(totalDeductions)} icon={MinusCircle} accent="rose" sub="أضرار وصيانة" />
        <KpiCard label="المسترد" value={formatMoney(totalRefunded)} icon={CheckCircle2} accent="emerald" sub="تم رده" />
        <KpiCard label="عدد الودائع" value={deposits.length.toLatinLocaleString('ar')} icon={FileCheck} accent="sky" sub="سجلات" />
      </ResponsiveCardGrid>

      <AsyncContentState
        status={contentStatus}
        error={depositsQuery.error as Error}
        errorTitle="تعذر تحميل الودائع"
        errorAction={<Button onClick={() => depositsQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد ودائع تأمين"
        emptyDescription="ابدأ بتسجيل وديعة تأمين مرتبطة بعقد نشط. سيتم حفظها عبر RPC ذري مع قيد محاسبي."
        emptyAction={<Button onClick={() => setActionType('create')}>تسجيل أول وديعة</Button>}
      >
        <div className="grid gap-3">
          {deposits.map((deposit) => (
            <Card key={deposit.id} className="border-border/60">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap justify-between gap-2 border-b pb-2">
                  <div>
                    <p className="text-sm font-bold">وديعة عقد {deposit.contract_id.slice(0, 8)} · {deposit.tenant_name || deposit.tenant_id || 'مستأجر'}</p>
                    <p className="text-xs text-muted-foreground">
                      {deposit.property_title || deposit.property_id || 'عقار'} · وحدة {deposit.unit_number || deposit.unit_id || '—'} · استلام: {deposit.received_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={getDepositTone(deposit.status)}>{depositStatusLabels[deposit.status]}</StatusBadge>
                    <Button variant="outline" size="sm" onClick={() => handlePrint(deposit)} className="gap-1">
                      <Printer className="size-3.5" />
                      طباعة
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(deposit)} className="gap-1">
                      <Download className="size-3.5" />
                      PDF
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-xl bg-muted/20 p-2"><span className="block text-muted-foreground">الأصلي</span><strong dir="ltr">{formatMoney(deposit.deposit_amount)}</strong></div>
                  <div className="rounded-xl bg-muted/20 p-2"><span className="block text-muted-foreground">المخصوم</span><strong className="text-destructive" dir="ltr">{formatMoney(deposit.deducted_amount)}</strong></div>
                  <div className="rounded-xl bg-muted/20 p-2"><span className="block text-muted-foreground">المسترد</span><strong className="text-success" dir="ltr">{formatMoney(deposit.refunded_amount)}</strong></div>
                  <div className="rounded-xl bg-primary/10 p-2"><span className="block text-muted-foreground">المتبقي</span><strong className="text-primary" dir="ltr">{formatMoney(deposit.remaining_amount)}</strong></div>
                </div>
                {deposit.remaining_amount > 0 && (
                  <div className="flex gap-2 border-t pt-2">
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive" onClick={() => { setSelectedDeposit(deposit); setActionType('deduct'); setAmountInput(deposit.remaining_amount); }}>
                      <ShieldAlert className="size-3.5" />
                      خصم ضرر
                    </Button>
                    <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={() => { setSelectedDeposit(deposit); setActionType('refund'); setAmountInput(deposit.remaining_amount); }}>
                      <DollarSign className="size-3.5" />
                      رد التأمين
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </AsyncContentState>

      <EntityForm.Overlay
        open={actionType === 'create'}
        onOpenChange={(open) => { if (!open) setActionType(null); }}
        title="تسجيل وديعة تأمين جديدة"
        description="يتم حفظ الوديعة عبر RPC ذري مع قيد محاسبي: مدين نقدية / دائن التزامات ودائع."
      >
        <EntityForm.Root
          aria-busy={createMut.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            createMut.mutate();
          }}
        >
          <EntityForm.ErrorSummary message={createMut.isError ? (createMut.error as Error).message : undefined} />
          <EntityForm.Section title="بيانات الوديعة">
            <EntityForm.Field label="العقد النشط *">
              <Select required value={createForm.contract_id} onChange={(event) => setCreateForm((form) => ({ ...form, contract_id: event.target.value }))}>
                <option value="">اختر العقد</option>
                {contractsQuery.data?.map((contract) => (
                  <option key={contract.id} value={contract.id}>{contract.id.slice(0, 8)} - عقار {contract.property_id?.slice(0, 6)}</option>
                ))}
              </Select>
            </EntityForm.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="المبلغ *">
                <Input required type="number" dir="ltr" value={createForm.amount} onChange={(event) => setCreateForm((form) => ({ ...form, amount: Number(event.target.value) || 0 }))} />
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
            submitDisabled={!createForm.contract_id || createForm.amount <= 0}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={actionType === 'deduct' || actionType === 'refund'}
        onOpenChange={(open) => { if (!open) { setActionType(null); setSelectedDeposit(null); } }}
        title={actionType === 'deduct' ? 'خصم من وديعة التأمين' : 'رد وديعة التأمين'}
        description={selectedDeposit ? `المتبقي: ${formatMoney(selectedDeposit.remaining_amount)} - لن يسمح النظام بتجاوز الرصيد` : undefined}
      >
        <EntityForm.Root
          aria-busy={deductMut.isPending || refundMut.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            executeSelectedAction();
          }}
        >
          <EntityForm.ErrorSummary message={(deductMut.error as Error)?.message || (refundMut.error as Error)?.message} />
          <EntityForm.Section title="بيانات العملية">
            <EntityForm.Field label="المبلغ *">
              <Input required type="number" dir="ltr" value={amountInput} onChange={(event) => setAmountInput(Number(event.target.value) || 0)} max={selectedDeposit?.remaining_amount} />
            </EntityForm.Field>
            {actionType === 'deduct' ? (
              <>
                <EntityForm.Field label="سبب الخصم *">
                  <Select value={reasonInput} onChange={(event) => setReasonInput(event.target.value as DepositDeductionPayload['reason'])}>
                    {Object.entries(deductionReasonLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </Select>
                </EntityForm.Field>
                <EntityForm.Field label="وصف تفصيلي *">
                  <Textarea value={descriptionInput} onChange={(event) => setDescriptionInput(event.target.value)} placeholder="تفاصيل الأضرار..." />
                </EntityForm.Field>
              </>
            ) : (
              <>
                <EntityForm.Field label="طريقة الدفع *">
                  <Select value={paymentMethodInput} onChange={(event) => setPaymentMethodInput(event.target.value as DepositRefundPayload['payment_method'])}>
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
            submitDisabled={amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}
