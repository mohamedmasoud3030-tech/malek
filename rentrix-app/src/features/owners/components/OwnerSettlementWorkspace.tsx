import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  CheckCircle2,
  DollarSign,
  Landmark,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Wallet,
} from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { numberToArabicWords, OMR_CURRENCY_CONFIG } from '@/lib/numberToArabicWords';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import {
  approveOwnerSettlement,
  createOwnerSettlementDraft,
  listOwnerSettlements,
  listOwnerSettlementTargets,
  processOwnerPayout,
  settlementStatusLabels,
  type CreateSettlementDraftPayload,
  type OwnerSettlementRecord,
  type OwnerSettlementTarget,
  type ProcessPayoutPayload,
} from '../services/owner-settlements-service';

const settlementsQueryKey = ['owner-settlements'] as const;
const settlementTargetsQueryKey = ['owner-settlement-targets'] as const;

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

type DraftFormState = {
  targetKey: string;
  periodStart: string;
  periodEnd: string;
  grossCollected: string;
  officeFee: string;
  ownerExpenses: string;
  taxAmount: string;
  notes: string;
};

function initialDraftForm(): DraftFormState {
  const today = getTodayLocalDateString();
  return {
    targetKey: '',
    periodStart: `${today.slice(0, 7)}-01`,
    periodEnd: today,
    grossCollected: '',
    officeFee: '',
    ownerExpenses: '0',
    taxAmount: '0',
    notes: '',
  };
}

function targetKey(target: Pick<OwnerSettlementTarget, 'owner_id' | 'property_id'>) {
  return `${target.owner_id}:${target.property_id}`;
}

function numberOrZero(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر إكمال العملية. أعد المحاولة.';
}

export function OwnerSettlementWorkspace() {
  const queryClient = useQueryClient();
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<DraftFormState>(initialDraftForm);
  const [draftValidationError, setDraftValidationError] = useState('');
  const [selectedSettlement, setSelectedSettlement] = useState<OwnerSettlementRecord | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<ProcessPayoutPayload['payout_method']>('bank_transfer');

  const settlementsQuery = useQuery({
    queryKey: settlementsQueryKey,
    queryFn: listOwnerSettlements,
  });
  const targetsQuery = useQuery({
    queryKey: settlementTargetsQueryKey,
    queryFn: listOwnerSettlementTargets,
  });

  const refreshSettlements = async () => {
    await queryClient.invalidateQueries({ queryKey: settlementsQueryKey });
  };

  const createMutation = useMutation({
    mutationFn: createOwnerSettlementDraft,
    onSuccess: async () => {
      await refreshSettlements();
      setDraftOpen(false);
      setDraftForm(initialDraftForm());
      setDraftValidationError('');
    },
  });
  const approveMutation = useMutation({
    mutationFn: approveOwnerSettlement,
    onSuccess: refreshSettlements,
  });
  const payoutMutation = useMutation({
    mutationFn: processOwnerPayout,
    onSuccess: async () => {
      await refreshSettlements();
      setSelectedSettlement(null);
      setPayoutRef('');
    },
  });

  const settlements = settlementsQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const selectedTarget = targets.find((target) => targetKey(target) === draftForm.targetKey) ?? null;

  const totalGrossCollected = useMemo(
    () => settlements.reduce((sum, settlement) => sum + settlement.gross_rent_collected, 0),
    [settlements],
  );
  const totalManagementCommissions = useMemo(
    () => settlements.reduce((sum, settlement) => sum + settlement.management_fee_amount, 0),
    [settlements],
  );
  const totalDeductions = useMemo(
    () => settlements.reduce(
      (sum, settlement) => sum + settlement.maintenance_deductions + settlement.utility_deductions,
      0,
    ),
    [settlements],
  );
  const totalNetPayable = useMemo(
    () => settlements.reduce((sum, settlement) => sum + settlement.net_payable_amount, 0),
    [settlements],
  );

  const activeMutationError = createMutation.error ?? approveMutation.error ?? payoutMutation.error;

  const handlePrintSettlementVoucher = (settlement: OwnerSettlementRecord) => {
    const tafqeetAmount = numberToArabicWords(settlement.net_payable_amount, OMR_CURRENCY_CONFIG);

    DocumentTemplates.printOwnerStatementDocument(
      {
        ownerName: settlement.owner_name,
        periodFrom: settlement.period_start,
        periodTo: settlement.period_end,
        propertyTitle: settlement.property_title,
        totalRent: settlement.gross_rent_collected,
        totalExpenses: settlement.maintenance_deductions + settlement.utility_deductions,
        totalCommission: settlement.management_fee_amount,
        netAmount: settlement.net_payable_amount,
        transactions: [
          {
            date: settlement.period_start,
            type: 'إيجارات مقبوضة',
            description: `تحصيلات إيجارات ${settlement.property_title}`,
            amount: settlement.gross_rent_collected,
          },
          {
            date: settlement.period_end,
            type: 'أتعاب إدارة',
            description: 'أتعاب المكتب المعتمدة في التسوية',
            amount: -settlement.management_fee_amount,
          },
          ...(settlement.maintenance_deductions > 0
            ? [{
                date: settlement.period_end,
                type: 'مصروفات على المالك',
                description: 'مصروفات تشغيلية مخصومة من مستحق المالك',
                amount: -settlement.maintenance_deductions,
              }]
            : []),
          ...(settlement.utility_deductions > 0
            ? [{
                date: settlement.period_end,
                type: 'ضريبة التسوية',
                description: 'الضريبة المسجلة بصورة مستقلة في التسوية',
                amount: -settlement.utility_deductions,
              }]
            : []),
        ],
        notes: settlement.notes ? `${settlement.notes}\nالمبلغ كتابة: ${tafqeetAmount}` : `المبلغ كتابة: ${tafqeetAmount}`,
      },
      defaultSettings,
    );
  };

  const handleTargetChange = (value: string) => {
    const target = targets.find((item) => targetKey(item) === value);
    const gross = numberOrZero(draftForm.grossCollected);
    const recommendedFee = target
      ? target.commission_type === 'percentage'
        ? gross * target.commission_value / 100
        : target.commission_value
      : 0;
    setDraftForm((current) => ({
      ...current,
      targetKey: value,
      officeFee: target ? String(Number(recommendedFee.toFixed(3))) : '',
    }));
  };

  const handleGrossChange = (value: string) => {
    const gross = numberOrZero(value);
    const recommendedFee = selectedTarget?.commission_type === 'percentage'
      ? gross * selectedTarget.commission_value / 100
      : selectedTarget?.commission_type === 'fixed'
        ? selectedTarget.commission_value
        : numberOrZero(draftForm.officeFee);
    setDraftForm((current) => ({
      ...current,
      grossCollected: value,
      officeFee: selectedTarget ? String(Number(recommendedFee.toFixed(3))) : current.officeFee,
    }));
  };

  const handleCreateDraft = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftValidationError('');
    if (!selectedTarget) {
      setDraftValidationError('اختر المالك والعقار المرتبطين باتفاقية إدارة.');
      return;
    }
    if (!draftForm.periodStart || !draftForm.periodEnd || draftForm.periodStart > draftForm.periodEnd) {
      setDraftValidationError('حدد فترة صحيحة؛ تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.');
      return;
    }

    const amounts = [
      numberOrZero(draftForm.grossCollected),
      numberOrZero(draftForm.officeFee),
      numberOrZero(draftForm.ownerExpenses),
      numberOrZero(draftForm.taxAmount),
    ];
    if (amounts.some((amount) => amount < 0) || amounts[0] <= 0) {
      setDraftValidationError('يجب أن يكون المحصل أكبر من صفر، وجميع المبالغ غير سالبة.');
      return;
    }

    const payload: CreateSettlementDraftPayload = {
      owner_id: selectedTarget.owner_id,
      property_id: selectedTarget.property_id,
      period_start: draftForm.periodStart,
      period_end: draftForm.periodEnd,
      gross_collected: amounts[0],
      office_fee: amounts[1],
      owner_expenses: amounts[2],
      tax_amount: amounts[3],
      notes: draftForm.notes.trim() || undefined,
    };
    createMutation.mutate(payload);
  };

  const handleApprove = (settlement: OwnerSettlementRecord) => {
    approveMutation.mutate({ settlement_id: settlement.id });
  };

  const handleExecutePayout = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSettlement || !payoutRef.trim()) return;
    payoutMutation.mutate({
      settlement_id: selectedSettlement.id,
      payout_method: payoutMethod,
      payout_reference: payoutRef.trim(),
      payout_date: getTodayLocalDateString(),
    });
  };

  const listStatus = settlementsQuery.isPending
    ? 'loading'
    : settlementsQuery.isError
      ? 'error'
      : settlements.length === 0
        ? 'empty'
        : 'ready';

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-muted/20">
        <CardHeader className="gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <CardTitle className="text-sm font-bold">مركز تسويات ومحاسبة الملاك</CardTitle>
            <CardDescription>
              مسودات حقيقية من قاعدة البيانات، ثم اعتماد وصرف ذري مع سجل تدقيق وقيد يومية متوازن.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => settlementsQuery.refetch()} disabled={settlementsQuery.isFetching}>
              <RefreshCw className="size-4" />
              تحديث
            </Button>
            <Button size="sm" onClick={() => setDraftOpen(true)} disabled={targetsQuery.isPending || targets.length === 0}>
              <Plus className="size-4" />
              إنشاء مسودة تسوية
            </Button>
          </div>
        </CardHeader>
      </Card>

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المقبوضات" value={formatMoney(totalGrossCollected)} icon={Wallet} accent="emerald" sub="تحصيلات مثبتة داخل التسويات" />
        <KpiCard label="أتعاب المكتب" value={formatMoney(totalManagementCommissions)} icon={Landmark} accent="primary" sub="أتعاب كل تسوية حسب اتفاقها" />
        <KpiCard label="المصروفات والضرائب" value={formatMoney(totalDeductions)} icon={DollarSign} accent="rose" sub="خصومات مسجلة على التسويات" />
        <KpiCard label="صافي مستحقات الملاك" value={formatMoney(totalNetPayable)} icon={BadgeCheck} accent="sky" sub="صافي جميع حالات التسوية" />
      </ResponsiveCardGrid>

      {activeMutationError ? (
        <EntityForm.ErrorSummary message={mutationErrorMessage(activeMutationError)} />
      ) : null}

      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-bold">التسويات المسجلة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <AsyncContentState
            status={listStatus}
            error={settlementsQuery.error}
            errorTitle="تعذر تحميل تسويات الملاك"
            errorAction={<Button variant="outline" onClick={() => settlementsQuery.refetch()}>إعادة المحاولة</Button>}
            emptyTitle="لا توجد تسويات مسجلة"
            emptyDescription="أنشئ أول مسودة من اتفاقية مالك وعقار؛ لن تظهر هنا أي بيانات تجريبية."
            emptyAction={targets.length > 0 ? <Button onClick={() => setDraftOpen(true)}>إنشاء مسودة تسوية</Button> : undefined}
          >
            {settlements.map((settlement) => {
              const tone = settlement.status === 'paid' ? 'green' : settlement.status === 'approved' ? 'blue' : settlement.status === 'cancelled' ? 'red' : 'gold';
              const isApproving = approveMutation.isPending && approveMutation.variables?.settlement_id === settlement.id;

              return (
                <article key={settlement.id} className="space-y-3 rounded-2xl border border-border/60 bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div>
                      <p className="text-sm font-bold">{settlement.owner_name}</p>
                      <p className="text-xs text-muted-foreground">{settlement.property_title} · {settlement.period_start} إلى {settlement.period_end}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={tone}>{settlementStatusLabels[settlement.status]}</StatusBadge>
                      <Button variant="outline" size="sm" onClick={() => handlePrintSettlementVoucher(settlement)}>
                        <Printer className="size-3.5" />
                        طباعة الكشف
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div className="rounded-xl bg-muted/20 p-2">
                      <span className="block text-muted-foreground">المحصل</span>
                      <strong className="text-sm" dir="ltr">{formatMoney(settlement.gross_rent_collected)}</strong>
                    </div>
                    <div className="rounded-xl bg-muted/20 p-2">
                      <span className="block text-muted-foreground">أتعاب المكتب</span>
                      <strong className="text-sm text-primary" dir="ltr">{formatMoney(settlement.management_fee_amount)}</strong>
                    </div>
                    <div className="rounded-xl bg-muted/20 p-2">
                      <span className="block text-muted-foreground">المصروفات والضريبة</span>
                      <strong className="text-sm text-destructive" dir="ltr">{formatMoney(settlement.maintenance_deductions + settlement.utility_deductions)}</strong>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 p-2">
                      <span className="block text-muted-foreground">الصافي للمالك</span>
                      <strong className="text-sm text-emerald-600" dir="ltr">{formatMoney(settlement.net_payable_amount)}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
                    <span className="text-muted-foreground">
                      {settlement.approved_at ? 'تم الاعتماد ماليًا' : 'في انتظار الاعتماد المالي'}
                      {settlement.payout_reference ? ` · مرجع الصرف: ${settlement.payout_reference}` : ''}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {settlement.status === 'pending' ? (
                        <Button size="sm" variant="secondary" onClick={() => handleApprove(settlement)} disabled={approveMutation.isPending}>
                          <CheckCircle2 className="size-3.5" />
                          {isApproving ? 'جارٍ الاعتماد…' : 'اعتماد التسوية'}
                        </Button>
                      ) : null}
                      {settlement.status === 'approved' ? (
                        <Button size="sm" onClick={() => setSelectedSettlement(settlement)} disabled={payoutMutation.isPending}>
                          <Send className="size-3.5" />
                          تسجيل صرف المستحق
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </AsyncContentState>
        </CardContent>
      </Card>

      <EntityForm.Overlay
        open={draftOpen}
        onOpenChange={setDraftOpen}
        title="إنشاء مسودة تسوية مالك"
        description="الأتعاب المقترحة تُحسب من اتفاقية العقار، ويمكن مراجعتها قبل الحفظ."
      >
        <EntityForm.Root onSubmit={handleCreateDraft} aria-busy={createMutation.isPending}>
          <EntityForm.ErrorSummary message={draftValidationError || (createMutation.error ? mutationErrorMessage(createMutation.error) : undefined)} />
          <EntityForm.Section title="المالك والعقار" description="لا تظهر إلا الروابط التي لديها اتفاقية إدارة حية.">
            <EntityForm.Field label="اتفاقية المالك والعقار">
              <Select value={draftForm.targetKey} onChange={(event) => handleTargetChange(event.target.value)} required>
                <option value="">اختر المالك والعقار</option>
                {targets.map((target) => (
                  <option key={targetKey(target)} value={targetKey(target)}>
                    {target.owner_name} — {target.property_title}
                  </option>
                ))}
              </Select>
            </EntityForm.Field>
            {selectedTarget ? (
              <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium text-muted-foreground">
                الاتفاق: {selectedTarget.commission_type === 'percentage' ? `نسبة ${selectedTarget.commission_value}% من المحصل` : `مبلغ ثابت ${formatMoney(selectedTarget.commission_value)}`}
              </p>
            ) : null}
          </EntityForm.Section>

          <EntityForm.Section title="الفترة والمبالغ">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="بداية الفترة">
                <Input type="date" value={draftForm.periodStart} onChange={(event) => setDraftForm((current) => ({ ...current, periodStart: event.target.value }))} required />
              </EntityForm.Field>
              <EntityForm.Field label="نهاية الفترة">
                <Input type="date" value={draftForm.periodEnd} onChange={(event) => setDraftForm((current) => ({ ...current, periodEnd: event.target.value }))} required />
              </EntityForm.Field>
              <EntityForm.Field label="إجمالي المحصل">
                <Input type="number" min="0.001" step="0.001" inputMode="decimal" value={draftForm.grossCollected} onChange={(event) => handleGrossChange(event.target.value)} required />
              </EntityForm.Field>
              <EntityForm.Field label="أتعاب المكتب">
                <Input type="number" min="0" step="0.001" inputMode="decimal" value={draftForm.officeFee} onChange={(event) => setDraftForm((current) => ({ ...current, officeFee: event.target.value }))} required />
              </EntityForm.Field>
              <EntityForm.Field label="مصروفات على المالك">
                <Input type="number" min="0" step="0.001" inputMode="decimal" value={draftForm.ownerExpenses} onChange={(event) => setDraftForm((current) => ({ ...current, ownerExpenses: event.target.value }))} required />
              </EntityForm.Field>
              <EntityForm.Field label="الضريبة">
                <Input type="number" min="0" step="0.001" inputMode="decimal" value={draftForm.taxAmount} onChange={(event) => setDraftForm((current) => ({ ...current, taxAmount: event.target.value }))} required />
              </EntityForm.Field>
            </div>
            <EntityForm.Field label="ملاحظات" description="اختياري؛ تظهر داخل كشف التسوية.">
              <Input value={draftForm.notes} onChange={(event) => setDraftForm((current) => ({ ...current, notes: event.target.value }))} />
            </EntityForm.Field>
          </EntityForm.Section>

          <EntityForm.Actions submitLabel={createMutation.isPending ? 'جارٍ إنشاء المسودة…' : 'إنشاء المسودة'} onCancel={() => setDraftOpen(false)} isSubmitting={createMutation.isPending} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={Boolean(selectedSettlement)}
        onOpenChange={(open) => {
          if (!open) setSelectedSettlement(null);
        }}
        title="تسجيل صرف مستحق المالك"
        description={selectedSettlement ? `${selectedSettlement.owner_name} · ${formatMoney(selectedSettlement.net_payable_amount)}` : undefined}
      >
        <EntityForm.Root onSubmit={handleExecutePayout} aria-busy={payoutMutation.isPending}>
          <EntityForm.ErrorSummary message={payoutMutation.error ? mutationErrorMessage(payoutMutation.error) : undefined} />
          <EntityForm.Section title="بيانات الصرف" description="عند التأكيد تُنشئ قاعدة البيانات قيد مالك مستحق/نقدية متوازنًا.">
            <EntityForm.Field label="وسيلة الصرف">
              <Select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as ProcessPayoutPayload['payout_method'])}>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="check">شيك مصرفي</option>
                <option value="cash">نقدًا</option>
              </Select>
            </EntityForm.Field>
            <EntityForm.Field label="رقم المرجع / المعاملة">
              <Input placeholder="مثال: TR-902184 / CHK-102" value={payoutRef} onChange={(event) => setPayoutRef(event.target.value)} required />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions submitLabel={payoutMutation.isPending ? 'جارٍ تسجيل الصرف…' : 'تأكيد الصرف'} onCancel={() => setSelectedSettlement(null)} isSubmitting={payoutMutation.isPending} submitDisabled={!payoutRef.trim()} />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}
