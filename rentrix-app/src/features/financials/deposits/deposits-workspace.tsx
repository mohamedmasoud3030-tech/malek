import { useMemo, useState } from 'react';
import { CheckCircle2, DollarSign, FileCheck, MinusCircle, Printer, ShieldAlert, Wallet, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
} from './deposit-service';
import { useProperties } from '@/features/properties/use-properties';
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
      const { data, error } = await supabase.from('contracts').select('id, tenant_id, property_id, unit_id').is('deleted_at', null).eq('status', 'active').limit(100).returns<Contract[]>();
      if (error) handleSupabaseError(error, 'تعذر تحميل العقود');
      return data ?? [];
    },
  });
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
  const propertiesQuery = useProperties({ page: 1, pageSize: 100, search: '', status: 'all' });

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
    onError: (err) => toast.error(err instanceof Error ? err.message : 'فشل إنشاء الوديعة'),
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
    onError: (err) => toast.error(err instanceof Error ? err.message : 'فشل الخصم - تحقق من الرصيد'),
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
    onError: (err) => toast.error(err instanceof Error ? err.message : 'فشل الاسترداد - تحقق من الرصيد'),
  });

  const totalHeld = useMemo(() => deposits.reduce((acc, d) => acc + d.remaining_amount, 0), [deposits]);
  const totalDeductions = useMemo(() => deposits.reduce((acc, d) => acc + d.deducted_amount, 0), [deposits]);
  const totalRefunded = useMemo(() => deposits.reduce((acc, d) => acc + d.refunded_amount, 0), [deposits]);

  const handlePrint = (d: DepositRecord) => {
    const tafqeet = numberToArabicWords(d.remaining_amount > 0 ? d.remaining_amount : d.deposit_amount, OMR_CURRENCY_CONFIG);
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'سند تسوية ومخالصة مبلغ التأمين',
        reportType: 'Tenant_Security_Deposit_Clearance',
        periodFrom: d.received_date,
        periodTo: getTodayLocalDateString(),
        sections: [
          {
            title: 'بيانات الوديعة',
            rows: [
              { label: 'معرف العقد', value: d.contract_id },
              { label: 'مبلغ التأمين الأصلي', value: `${d.deposit_amount} ر.ع` },
              { label: 'الخصومات', value: `${d.deducted_amount} ر.ع` },
              { label: 'المسترد', value: `${d.refunded_amount} ر.ع` },
              { label: 'المتبقي', value: `${d.remaining_amount} ر.ع` },
              { label: 'تفقيط المتبقي', value: tafqeet },
            ],
            totals: ['الصافي', `${d.remaining_amount} ر.ع`],
          },
        ],
        totalSummary: `تاريخ المخالصة: ${getTodayLocalDateString()}`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-muted/20">
        <CardHeader className="px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold">دفتر أمانات وتأمينات المستأجرين</CardTitle>
              <CardDescription>مسار مالي حقيقي مع سجل غير قابل للتلاعب، منع تجاوز الرصيد، وقيود محاسبية.</CardDescription>
            </div>
            <Button onClick={() => setActionType('create')} className="min-h-11 gap-2">
              <Plus className="size-4" />
              تسجيل وديعة جديدة
            </Button>
          </div>
        </CardHeader>
      </Card>

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="الأمانات المحتجزة" value={formatMoney(totalHeld)} icon={Wallet} accent="emerald" sub="واجب الرد" />
        <KpiCard label="الخصومات" value={formatMoney(totalDeductions)} icon={MinusCircle} accent="rose" sub="أضرار وصيانة" />
        <KpiCard label="المسترد" value={formatMoney(totalRefunded)} icon={CheckCircle2} accent="sky" sub="تم رده" />
        <KpiCard label="عدد الودائع" value={deposits.length.toLocaleString('ar')} icon={FileCheck} accent="primary" sub="سجلات" />
      </ResponsiveCardGrid>

      <AsyncContentState
        status={depositsQuery.isLoading ? 'loading' : depositsQuery.isError ? 'error' : deposits.length === 0 ? 'empty' : 'ready'}
        error={depositsQuery.error as Error}
        errorTitle="تعذر تحميل الودائع"
        errorAction={<Button onClick={() => depositsQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد ودائع تأمين"
        emptyDescription="ابدأ بتسجيل وديعة تأمين مرتبطة بعقد نشط. سيتم حفظها عبر RPC ذري مع قيد محاسبي."
        emptyAction={<Button onClick={() => setActionType('create')}>تسجيل أول وديعة</Button>}
      >
        <div className="grid gap-3">
          {deposits.map((d) => {
            const tone = d.status === 'refunded' ? 'green' : d.status === 'held' ? 'blue' : 'gold';
            return (
              <Card key={d.id} className="border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2 border-b pb-2">
                    <div>
                      <p className="font-bold text-sm">وديعة عقد {d.contract_id.slice(0, 8)} · {d.tenant_name || d.tenant_id || 'مستأجر'}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.property_title || d.property_id || 'عقار'} · وحدة {d.unit_number || d.unit_id || '—'} · استلام: {d.received_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={tone as any}>{depositStatusLabels[d.status]}</StatusBadge>
                      <Button variant="outline" size="sm" onClick={() => handlePrint(d)} className="gap-1">
                        <Printer className="size-3.5" />
                        طباعة
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/20 p-2">
                      <span className="text-muted-foreground block">الأصلي</span>
                      <strong dir="ltr">{formatMoney(d.deposit_amount)}</strong>
                    </div>
                    <div className="rounded-xl bg-muted/20 p-2">
                      <span className="text-muted-foreground block">المخصوم</span>
                      <strong className="text-destructive" dir="ltr">
                        {formatMoney(d.deducted_amount)}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-muted/20 p-2">
                      <span className="text-muted-foreground block">المسترد</span>
                      <strong className="text-emerald-600" dir="ltr">
                        {formatMoney(d.refunded_amount)}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2">
                      <span className="text-muted-foreground block">المتبقي</span>
                      <strong className="text-primary" dir="ltr">
                        {formatMoney(d.remaining_amount)}
                      </strong>
                    </div>
                  </div>
                  {d.remaining_amount > 0 && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1 text-destructive"
                        onClick={() => {
                          setSelectedDeposit(d);
                          setActionType('deduct');
                          setAmountInput(d.remaining_amount);
                        }}
                      >
                        <ShieldAlert className="size-3.5" />
                        خصم ضرر
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs gap-1"
                        onClick={() => {
                          setSelectedDeposit(d);
                          setActionType('refund');
                          setAmountInput(d.remaining_amount);
                        }}
                      >
                        <DollarSign className="size-3.5" />
                        رد التأمين
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </AsyncContentState>

      {/* Create Dialog */}
      <Dialog open={actionType === 'create'} onOpenChange={(open) => { if (!open) setActionType(null); }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تسجيل وديعة تأمين جديدة</DialogTitle>
            <DialogDescription>يتم حفظ الوديعة عبر RPC ذري مع قيد محاسبي: مدين نقدية / دائن التزامات ودائع.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>العقد النشط *</Label>
              <Select value={createForm.contract_id} onChange={(e) => setCreateForm((f) => ({ ...f, contract_id: e.target.value }))}>
                <option value="">اختر العقد</option>
                {contractsQuery.data?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.id.slice(0, 8)} - عقار {c.property_id?.slice(0, 6)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>المبلغ *</Label>
                <Input type="number" dir="ltr" value={createForm.amount} onChange={(e) => setCreateForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))} />
              </div>
              <div className="grid gap-2">
                <Label>تاريخ الاستلام *</Label>
                <Input type="date" value={createForm.received_date} onChange={(e) => setCreateForm((f) => ({ ...f, received_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>ملاحظات</Label>
              <Input value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات الاستلام..." />
            </div>
            {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !createForm.contract_id || createForm.amount <= 0} className="min-h-11">
              {createMut.isPending ? 'جارٍ الحفظ...' : 'حفظ الوديعة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deduct / Refund Dialog */}
      <Dialog
        open={actionType === 'deduct' || actionType === 'refund'}
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setSelectedDeposit(null);
          }
        }}
      >
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{actionType === 'deduct' ? 'خصم من وديعة التأمين' : 'رد وديعة التأمين'}</DialogTitle>
            <DialogDescription>
              {selectedDeposit ? `المتبقي: ${formatMoney(selectedDeposit.remaining_amount)} - لن يسمح النظام بتجاوز الرصيد` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>المبلغ *</Label>
              <Input type="number" dir="ltr" value={amountInput} onChange={(e) => setAmountInput(Number(e.target.value) || 0)} max={selectedDeposit?.remaining_amount} />
            </div>
            {actionType === 'deduct' ? (
              <>
                <div className="grid gap-2">
                  <Label>سبب الخصم *</Label>
                  <Select value={reasonInput} onChange={(e) => setReasonInput(e.target.value as any)}>
                    {Object.entries(deductionReasonLabels).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>وصف تفصيلي *</Label>
                  <Textarea value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} placeholder="تفاصيل الأضرار..." />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>طريقة الدفع *</Label>
                  <Select value={paymentMethodInput} onChange={(e) => setPaymentMethodInput(e.target.value as any)}>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقداً</option>
                    <option value="check">شيك</option>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>ملاحظات</Label>
                  <Input value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} placeholder="ملاحظات الاسترداد..." />
                </div>
              </>
            )}
            {(deductMut.isError || refundMut.isError) && (
              <p className="text-sm text-destructive">{(deductMut.error as Error)?.message || (refundMut.error as Error)?.message}</p>
            )}
            <Button
              onClick={() => (actionType === 'deduct' ? deductMut.mutate() : refundMut.mutate())}
              disabled={amountInput <= 0 || (selectedDeposit ? amountInput > selectedDeposit.remaining_amount : true) || deductMut.isPending || refundMut.isPending}
              className="min-h-11"
            >
              {deductMut.isPending || refundMut.isPending ? 'جارٍ التنفيذ...' : 'تأكيد العملية'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
