import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useMemo,
  useState,
} from 'react';
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
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
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
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentTemplates } from '@/services/documents/DocumentTemplates';
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر إكمال العملية. أعد المحاولة.';
}

function settlementTone(status: OwnerSettlementRecord['status']) {
  if (status === 'paid') return 'green' as const;
  if (status === 'approved') return 'blue' as const;
  if (status === 'cancelled') return 'red' as const;
  return 'gold' as const;
}

export function OwnerSettlementWorkspace() {
  const queryClient = useQueryClient();
  // Financial-control gate: opening this page only requires
  // financial.owner_settlements.view, but approval and payout execution stay
  // behind their dedicated permissions (ADMIN by default).
  const { authorization } = useAuth();
  const canApproveSettlement = canAccess(authorization, 'financial.owner_settlements.approve');
  const canPaySettlement = canAccess(authorization, 'financial.owner_settlements.pay');
  const documentSettings = useDocumentSettings();
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

  const totals = useMemo(
    // Cancelled drafts never create a payable or collection. Including them made
    // the control totals look larger than the ledger-backed live settlements.
    () => settlements
      .filter((settlement) => settlement.status !== 'cancelled')
      .reduce(
        (summary, settlement) => ({
          gross: summary.gross + settlement.gross_rent_collected,
          fees: summary.fees + settlement.management_fee_amount,
          deductions: summary.deductions + settlement.maintenance_deductions + settlement.utility_deductions,
          net: summary.net + settlement.net_payable_amount,
        }),
        { gross: 0, fees: 0, deductions: 0, net: 0 },
      ),
    [settlements],
  );

  const activeMutationError = createMutation.error ?? approveMutation.error ?? payoutMutation.error;
  const backgroundRefreshError = settlements.length > 0 && settlementsQuery.isError
    ? settlementsQuery.error
    : null;

  const handleDraftOpenChange = (open: boolean) => {
    setDraftOpen(open);
    if (!open) {
      setDraftForm(initialDraftForm());
      setDraftValidationError('');
      createMutation.reset();
    }
  };

  const handlePayoutOpenChange = (open: boolean) => {
    if (open) return;
    setSelectedSettlement(null);
    setPayoutRef('');
    payoutMutation.reset();
  };

  const handlePrint = (settlement: OwnerSettlementRecord) => {
    if (!documentSettings.isReady) return;
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
                description: 'مصروفات مخصومة من مستحق المالك',
                amount: -settlement.maintenance_deductions,
              }]
            : []),
          ...(settlement.utility_deductions > 0
            ? [{
                date: settlement.period_end,
                type: 'ضريبة التسوية',
                description: 'ضريبة مسجلة مستقلة داخل التسوية',
                amount: -settlement.utility_deductions,
              }]
            : []),
        ],
      },
      documentSettings.settings,
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

  const handleCreateDraft = (event: FormEvent<HTMLFormElement>) => {
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

  const handlePayout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSettlement || !payoutRef.trim()) return;
    payoutMutation.mutate({
      settlement_id: selectedSettlement.id,
      payout_method: payoutMethod,
      payout_reference: payoutRef.trim(),
    });
  };

  const listStatus = settlementsQuery.isPending
    ? 'loading'
    : settlementsQuery.isError && settlements.length === 0
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
            <Button
              size="sm"
              onClick={() => handleDraftOpenChange(true)}
              disabled={targetsQuery.isPending || targets.length === 0}
            >
              <Plus className="size-4" />
              إنشاء مسودة تسوية
            </Button>
          </div>
        </CardHeader>
      </Card>

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المقبوضات" value={formatMoney(totals.gross)} icon={Wallet} accent="emerald" sub="تحصيلات مثبتة داخل التسويات" />
        <KpiCard label="أتعاب المكتب" value={formatMoney(totals.fees)} icon={Landmark} accent="primary" sub="أتعاب كل تسوية حسب اتفاقها" />
        <KpiCard label="المصروفات والضرائب" value={formatMoney(totals.deductions)} icon={DollarSign} accent="rose" sub="خصومات مسجلة على التسويات" />
        <KpiCard label="صافي مستحقات الملاك" value={formatMoney(totals.net)} icon={BadgeCheck} accent="sky" sub="صافي جميع حالات التسوية" />
      </ResponsiveCardGrid>

      {activeMutationError ? <EntityForm.ErrorSummary message={errorMessage(activeMutationError)} /> : null}
      {backgroundRefreshError ? (
        <EntityForm.ErrorSummary message={`تعذر تحديث التسويات؛ ما زالت آخر بيانات ناجحة ظاهرة. ${errorMessage(backgroundRefreshError)}`} />
      ) : null}
      {!documentSettings.isReady && !documentSettings.isLoading ? (
        <EntityForm.ErrorSummary message="أكمل اسم الشركة والعملة في الإعدادات لتفعيل طباعة كشوف التسوية دون بيانات افتراضية." />
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
            emptyAction={targets.length > 0 ? <Button onClick={() => handleDraftOpenChange(true)}>إنشاء مسودة تسوية</Button> : undefined}
          >
            {settlements.map((settlement) => {
              const isApproving = approveMutation.isPending && approveMutation.variables?.settlement_id === settlement.id;
              return (
                <article key={settlement.id} className="space-y-3 rounded-2xl border border-border/60 bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div>
                      <p className="text-sm font-bold">{settlement.owner_name}</p>
                      <p className="text-xs text-muted-foreground">{settlement.property_title} · {settlement.period_start} إلى {settlement.period_end}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={settlementTone(settlement.status)}>{settlementStatusLabels[settlement.status]}</StatusBadge>
                      <Button variant="outline" size="sm" onClick={() => handlePrint(settlement)} disabled={!documentSettings.isReady}>
                        <Printer className="size-3.5" />
                        طباعة الكشف
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <Metric label="المحصل" value={settlement.gross_rent_collected} />
                    <Metric label="أتعاب المكتب" value={settlement.management_fee_amount} tone="primary" />
                    <Metric label="المصروفات والضريبة" value={settlement.maintenance_deductions + settlement.utility_deductions} tone="danger" />
                    <Metric label="الصافي للمالك" value={settlement.net_payable_amount} tone="success" />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
                    <span className="text-muted-foreground">
                      {settlement.approved_at ? 'تم الاعتماد ماليًا' : 'في انتظار الاعتماد المالي'}
                      {settlement.payout_reference ? ` · مرجع الصرف: ${settlement.payout_reference}` : ''}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {settlement.status === 'pending' && canApproveSettlement ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => approveMutation.mutate({ settlement_id: settlement.id })}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="size-3.5" />
                          {isApproving ? 'جارٍ الاعتماد…' : 'اعتماد التسوية'}
                        </Button>
                      ) : null}
                      {settlement.status === 'approved' && canPaySettlement ? (
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

      <DraftOverlay
        open={draftOpen}
        onOpenChange={handleDraftOpenChange}
        form={draftForm}
        setForm={setDraftForm}
        targets={targets}
        selectedTarget={selectedTarget}
        validationError={draftValidationError}
        mutationError={createMutation.error}
        isSubmitting={createMutation.isPending}
        onTargetChange={handleTargetChange}
        onGrossChange={handleGrossChange}
        onSubmit={handleCreateDraft}
      />

      <EntityForm.Overlay
        open={Boolean(selectedSettlement)}
        onOpenChange={handlePayoutOpenChange}
        title="تسجيل صرف مستحق المالك"
        description={selectedSettlement ? `${selectedSettlement.owner_name} · ${formatMoney(selectedSettlement.net_payable_amount)}` : undefined}
      >
        <EntityForm.Root onSubmit={handlePayout} aria-busy={payoutMutation.isPending}>
          <EntityForm.ErrorSummary message={payoutMutation.error ? errorMessage(payoutMutation.error) : undefined} />
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
          <EntityForm.Actions
            submitLabel={payoutMutation.isPending ? 'جارٍ تسجيل الصرف…' : 'تأكيد الصرف'}
            onCancel={() => handlePayoutOpenChange(false)}
            isSubmitting={payoutMutation.isPending}
            submitDisabled={!payoutRef.trim()}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'primary' | 'danger' | 'success' }) {
  const className = tone === 'primary'
    ? 'text-primary'
    : tone === 'danger'
      ? 'text-destructive'
      : tone === 'success'
        ? 'text-emerald-600'
        : 'text-foreground';
  return (
    <div className="rounded-xl bg-muted/20 p-2">
      <span className="block text-muted-foreground">{label}</span>
      <strong className={`text-sm ${className}`} dir="ltr">{formatMoney(value)}</strong>
    </div>
  );
}

type DraftOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: DraftFormState;
  setForm: Dispatch<SetStateAction<DraftFormState>>;
  targets: OwnerSettlementTarget[];
  selectedTarget: OwnerSettlementTarget | null;
  validationError: string;
  mutationError: unknown;
  isSubmitting: boolean;
  onTargetChange: (value: string) => void;
  onGrossChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function DraftOverlay({
  open,
  onOpenChange,
  form,
  setForm,
  targets,
  selectedTarget,
  validationError,
  mutationError,
  isSubmitting,
  onTargetChange,
  onGrossChange,
  onSubmit,
}: DraftOverlayProps) {
  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={onOpenChange}
      title="إنشاء مسودة تسوية مالك"
      description="الأتعاب المقترحة تُحسب من اتفاقية العقار، ويمكن مراجعتها قبل الحفظ."
    >
      <EntityForm.Root onSubmit={onSubmit} aria-busy={isSubmitting}>
        <EntityForm.ErrorSummary message={validationError || (mutationError ? errorMessage(mutationError) : undefined)} />
        <EntityForm.Section title="المالك والعقار" description="لا تظهر إلا الروابط التي لديها اتفاقية إدارة حية.">
          <EntityForm.Field label="اتفاقية المالك والعقار">
            <Select value={form.targetKey} onChange={(event) => onTargetChange(event.target.value)} required>
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
              الاتفاق: {selectedTarget.commission_type === 'percentage'
                ? `نسبة ${selectedTarget.commission_value}% من المحصل`
                : `مبلغ ثابت ${formatMoney(selectedTarget.commission_value)}`}
            </p>
          ) : null}
        </EntityForm.Section>

        <EntityForm.Section title="الفترة والمبالغ">
          <div className="grid gap-4 sm:grid-cols-2">
            <DraftField label="بداية الفترة" type="date" value={form.periodStart} onChange={(value) => setForm((current) => ({ ...current, periodStart: value }))} />
            <DraftField label="نهاية الفترة" type="date" value={form.periodEnd} onChange={(value) => setForm((current) => ({ ...current, periodEnd: value }))} />
            <DraftField label="إجمالي المحصل" value={form.grossCollected} min="0.001" onChange={onGrossChange} />
            <DraftField label="أتعاب المكتب" value={form.officeFee} onChange={(value) => setForm((current) => ({ ...current, officeFee: value }))} />
            <DraftField label="مصروفات على المالك" value={form.ownerExpenses} onChange={(value) => setForm((current) => ({ ...current, ownerExpenses: value }))} />
            <DraftField label="الضريبة" value={form.taxAmount} onChange={(value) => setForm((current) => ({ ...current, taxAmount: value }))} />
          </div>
          <EntityForm.Field label="ملاحظات" description="اختياري؛ تحفظ داخل التسوية.">
            <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </EntityForm.Field>
        </EntityForm.Section>

        <EntityForm.Actions
          submitLabel={isSubmitting ? 'جارٍ إنشاء المسودة…' : 'إنشاء المسودة'}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

function DraftField({
  label,
  value,
  onChange,
  type = 'number',
  min = '0',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'number' | 'date';
  min?: string;
}) {
  return (
    <EntityForm.Field label={label}>
      <Input
        type={type}
        min={type === 'number' ? min : undefined}
        step={type === 'number' ? '0.001' : undefined}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </EntityForm.Field>
  );
}
