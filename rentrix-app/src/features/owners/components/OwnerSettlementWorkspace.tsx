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
  Download,
  DollarSign,
  Landmark,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { Button } from '@/components/ui/button';
import { ActionMenu } from '@/components/ui/action-menu';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { toOwnerStatementDocumentPayload, type OwnerStatementData } from '@/services/documents/documentPayloadAdapters';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import {
  approveOwnerSettlement,
  createOwnerSettlementDraft,
  listOwnerSettlements,
  listOwnerSettlementTargets,
  previewOwnerSettlement,
  processOwnerPayout,
  settlementStatusLabels,
  summarizeLiveOwnerSettlements,
  type CreateSettlementDraftPayload,
  type OwnerSettlementPreview,
  type OwnerSettlementRecord,
  type OwnerSettlementTarget,
  type ProcessPayoutPayload,
} from '../services/owner-settlements-service';

const settlementsQueryKey = ['owner-settlements'] as const;
const settlementTargetsQueryKey = ['owner-settlement-targets'] as const;
const settlementPreviewQueryKey = 'owner-settlement-preview' as const;

type DraftFormState = {
  targetKey: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
};

function initialDraftForm(): DraftFormState {
  const today = getTodayLocalDateString();
  return {
    targetKey: '',
    periodStart: `${today.slice(0, 7)}-01`,
    periodEnd: today,
    notes: '',
  };
}

function targetKey(target: Pick<OwnerSettlementTarget, 'owner_id' | 'property_id'>) {
  return `${target.owner_id}:${target.property_id}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر إكمال العملية. أعد المحاولة.';
}

function settlementTone(status: OwnerSettlementRecord['status']) {
  if (status === 'paid') return 'success' as const;
  if (status === 'approved') return 'info' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'warning' as const;
}

export function OwnerSettlementWorkspace() {
  const queryClient = useQueryClient();
  const { authorization } = useAuth();
  const canApproveSettlement = canAccess(authorization, 'financial.owner_settlements.approve');
  const canPaySettlement = canAccess(authorization, 'financial.owner_settlements.pay');
  const documentSettings = useDocumentSettings();
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<DraftFormState>(initialDraftForm);
  const [draftValidationError, setDraftValidationError] = useState('');
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<OwnerSettlementRecord | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<ProcessPayoutPayload['payout_method']>('bank_transfer');

  const settlementsQuery = useQuery({ queryKey: settlementsQueryKey, queryFn: listOwnerSettlements });
  const targetsQuery = useQuery({ queryKey: settlementTargetsQueryKey, queryFn: listOwnerSettlementTargets });

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
  const approveMutation = useMutation({ mutationFn: approveOwnerSettlement, onSuccess: refreshSettlements });
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

  const previewScopeValid = Boolean(selectedTarget)
    && Boolean(draftForm.periodStart)
    && Boolean(draftForm.periodEnd)
    && draftForm.periodStart <= draftForm.periodEnd;
  const previewQuery = useQuery({
    queryKey: [settlementPreviewQueryKey, draftForm.targetKey, draftForm.periodStart, draftForm.periodEnd],
    queryFn: () => previewOwnerSettlement({
      owner_id: selectedTarget!.owner_id,
      property_id: selectedTarget!.property_id,
      period_start: draftForm.periodStart,
      period_end: draftForm.periodEnd,
    }),
    enabled: previewScopeValid,
  });
  const preview = previewQuery.data ?? null;
  const totals = useMemo(() => summarizeLiveOwnerSettlements(settlements), [settlements]);
  const activeMutationError = createMutation.error ?? approveMutation.error ?? payoutMutation.error;
  const backgroundRefreshError = settlements.length > 0 && settlementsQuery.isError ? settlementsQuery.error : null;

  const handleDraftOpenChange = (open: boolean) => {
    setDraftOpen(open);
    if (open) {
      setDraftRequestId(crypto.randomUUID());
    } else {
      setDraftForm(initialDraftForm());
      setDraftValidationError('');
      setDraftRequestId(null);
      createMutation.reset();
    }
  };

  const handlePayoutOpenChange = (open: boolean) => {
    if (open) return;
    setSelectedSettlement(null);
    setPayoutRef('');
    payoutMutation.reset();
  };

  const buildOwnerStatementData = (settlement: OwnerSettlementRecord) => ({
    ownerName: settlement.owner_name,
    periodFrom: settlement.period_start,
    periodTo: settlement.period_end,
    propertyTitle: settlement.property_title,
    totalRent: settlement.gross_rent_collected,
    totalExpenses: settlement.owner_expenses + settlement.fee_vat_amount,
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
      ...(settlement.owner_expenses > 0
        ? [{
            date: settlement.period_end,
            type: 'مصروفات على المالك',
            description: 'مصروفات مخصومة من مستحق المالك',
            amount: -settlement.owner_expenses,
          }]
        : []),
      ...(settlement.fee_vat_amount > 0
        ? [{
            date: settlement.period_end,
            type: 'ضريبة القيمة المضافة على الأتعاب',
            description: 'ضريبة محتسبة من الخادم على أتعاب الإدارة',
            amount: -settlement.fee_vat_amount,
          }]
        : []),
    ],
  });

  const handlePrint = (settlement: OwnerSettlementRecord) => {
    // Guard inside the async boundary so the handler fails closed with a
    // visible Arabic reason rather than silently doing nothing.
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => {
        const data = buildOwnerStatementData(settlement) satisfies OwnerStatementData;
        return documentService.printDocument('owner_statement', { settings: documentSettings.companySettings, payload: toOwnerStatementDocumentPayload(data) });
      },
      fallbackMessage: 'تعذرت طباعة كشف التسوية.',
    });
  };

  const handleDownloadPdf = (settlement: OwnerSettlementRecord) => {
    // Guard inside the async boundary so the handler fails closed with a
    // visible Arabic reason rather than silently doing nothing.
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => {
        const data = buildOwnerStatementData(settlement) satisfies OwnerStatementData;
        return documentService.downloadDocumentPdf('owner_statement', { settings: documentSettings.companySettings, payload: toOwnerStatementDocumentPayload(data) });
      },
      fallbackMessage: 'تعذر تنزيل كشف التسوية كملف PDF.',
    });
  };

  const handleTargetChange = (value: string) => setDraftForm((current) => ({ ...current, targetKey: value }));

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
    if (!preview) {
      setDraftValidationError(previewQuery.isError ? errorMessage(previewQuery.error) : 'انتظر اكتمال معاينة الخادم قبل إنشاء المسودة.');
      return;
    }
    const requestId = draftRequestId ?? crypto.randomUUID();
    if (!draftRequestId) setDraftRequestId(requestId);
    const payload: CreateSettlementDraftPayload = {
      owner_id: selectedTarget.owner_id,
      property_id: selectedTarget.property_id,
      period_start: draftForm.periodStart,
      period_end: draftForm.periodEnd,
      request_id: requestId,
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

  const settlementActions = (settlement: OwnerSettlementRecord) => {
    const isApproving = approveMutation.isPending && approveMutation.variables?.settlement_id === settlement.id;
    return [
      { id: 'print', label: 'طباعة الكشف', icon: Printer, onClick: () => handlePrint(settlement), disabled: !documentSettings.isReady },
      { id: 'pdf', label: 'تنزيل PDF', icon: Download, onClick: () => handleDownloadPdf(settlement), disabled: !documentSettings.isReady },
      ...(settlement.status === 'pending' && canApproveSettlement
        ? [{ id: 'approve', label: isApproving ? 'جارٍ الاعتماد…' : 'اعتماد التسوية', icon: CheckCircle2, onClick: () => approveMutation.mutate({ settlement_id: settlement.id }), disabled: approveMutation.isPending }]
        : []),
      ...(settlement.status === 'approved' && canPaySettlement
        ? [{ id: 'payout', label: 'تسجيل صرف المستحق', icon: Send, onClick: () => setSelectedSettlement(settlement), disabled: payoutMutation.isPending }]
        : []),
    ];
  };

  const columns: ColumnDef<OwnerSettlementRecord>[] = [
    {
      key: 'owner',
      header: 'المالك والعقار',
      render: (settlement) => (
        <div className="min-w-0">
          <p className="font-bold">{settlement.owner_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{settlement.property_title}</p>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'الفترة',
      render: (settlement) => <span dir="ltr" className="text-xs tabular-nums">{settlement.period_start} → {settlement.period_end}</span>,
    },
    { key: 'gross', header: 'المحصّل', render: (settlement) => <strong dir="ltr">{formatMoney(settlement.gross_rent_collected)}</strong> },
    { key: 'fees', header: 'أتعاب المكتب', render: (settlement) => <strong dir="ltr" className="text-primary">{formatMoney(settlement.management_fee_amount)}</strong> },
    {
      key: 'expenses',
      header: 'مصروفات المالك',
      render: (settlement) => <strong dir="ltr" className="text-destructive">{formatMoney(settlement.owner_expenses)}</strong>,
    },
    {
      key: 'feeVat',
      header: 'ضريبة الأتعاب',
      render: (settlement) => <strong dir="ltr" className="text-destructive">{formatMoney(settlement.fee_vat_amount)}</strong>,
    },
    { key: 'net', header: 'الصافي', render: (settlement) => <strong dir="ltr" className="text-success">{formatMoney(settlement.net_payable_amount)}</strong> },
    { key: 'status', header: 'الحالة', render: (settlement) => <StatusBadge tone={settlementTone(settlement.status)}>{settlementStatusLabels[settlement.status]}</StatusBadge> },
    { key: 'actions', header: 'إجراءات', render: (settlement) => <ActionMenu label={`إجراءات تسوية ${settlement.owner_name}`} items={settlementActions(settlement)} /> },
  ];

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-base font-bold tracking-tight">مركز تسويات ومحاسبة الملاك</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            مسودات حقيقية من قاعدة البيانات، ثم اعتماد وصرف ذري مع سجل تدقيق وقيد يومية متوازن.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Button variant="outline" className="min-h-11" onClick={() => settlementsQuery.refetch()} disabled={settlementsQuery.isFetching}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button className="min-h-11" onClick={() => handleDraftOpenChange(true)} disabled={targetsQuery.isPending || targets.length === 0}>
            <Plus className="size-4" />
            إنشاء مسودة تسوية
          </Button>
        </div>
      </section>

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المقبوضات" value={formatMoney(totals.gross)} icon={Wallet} accent="emerald" sub="تحصيلات مثبتة داخل التسويات" />
        <KpiCard label="أتعاب المكتب" value={formatMoney(totals.fees)} icon={Landmark} accent="primary" sub="أتعاب كل تسوية حسب اتفاقها" />
        <KpiCard label="المصروفات والضرائب" value={formatMoney(totals.expenses + totals.feeVat)} icon={DollarSign} accent="rose" sub="مصروفات المالك وضريبة الأتعاب من الخادم" />
        <KpiCard label="صافي مستحقات الملاك" value={formatMoney(totals.outstandingNet)} icon={BadgeCheck} accent="sky" sub="مسودات ومعتمدة لم تُصرف بعد — تُستبعد المدفوعة والملغاة" />
      </ResponsiveCardGrid>

      <SettlementSupervisionBanner
        settlements={settlements}
        canApproveSettlement={canApproveSettlement}
        canPaySettlement={canPaySettlement}
      />

      {activeMutationError ? <EntityForm.ErrorSummary message={errorMessage(activeMutationError)} /> : null}
      {backgroundRefreshError ? (
        <EntityForm.ErrorSummary message={`تعذر تحديث التسويات؛ ما زالت آخر بيانات ناجحة ظاهرة. ${errorMessage(backgroundRefreshError)}`} />
      ) : null}
      {!documentSettings.isReady && !documentSettings.isLoading ? (
        <EntityForm.ErrorSummary message="أكمل اسم الشركة والعملة في الإعدادات لتفعيل طباعة كشوف التسوية دون بيانات افتراضية." />
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-3 shadow-card sm:p-4" aria-label="سجل تسويات الملاك">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black">التسويات المسجلة</h3>
            <p className="mt-1 text-xs text-muted-foreground">جدول مدمج مع إفصاح تدريجي على الهاتف.</p>
          </div>
          <StatusBadge tone="neutral">{settlements.length} سجل</StatusBadge>
        </header>
        <AsyncContentState
          status={listStatus}
          error={settlementsQuery.error}
          errorTitle="تعذر تحميل تسويات الملاك"
          errorAction={<Button variant="outline" onClick={() => settlementsQuery.refetch()}>إعادة المحاولة</Button>}
          emptyTitle="لا توجد تسويات مسجلة"
          emptyDescription="أنشئ أول مسودة من اتفاقية مالك وعقار؛ لن تظهر هنا أي بيانات تجريبية."
          emptyAction={targets.length > 0 ? <Button onClick={() => handleDraftOpenChange(true)}>إنشاء مسودة تسوية</Button> : undefined}
        >
          <EntityTable
            aria-label="جدول تسويات الملاك"
            rows={settlements}
            columns={columns}
            keyOf={(settlement) => settlement.id}
            mobileVisibleSecondaryKey="net"
          />
        </AsyncContentState>
      </section>

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
        preview={preview}
        previewLoading={previewQuery.isLoading || previewQuery.isFetching}
        previewError={previewQuery.isError ? errorMessage(previewQuery.error) : ''}
        onSubmit={handleCreateDraft}
      />

      <EntityForm.Overlay
        open={Boolean(selectedSettlement)}
        onOpenChange={handlePayoutOpenChange}
        title="تسجيل صرف مستحق المالك"
        description={selectedSettlement ? `${selectedSettlement.owner_name} · ${formatMoney(selectedSettlement.net_payable_amount)}` : undefined}
        visualVariant="operational"
      >
        <EntityForm.Root onSubmit={handlePayout} aria-busy={payoutMutation.isPending}>
          <EntityForm.ErrorSummary message={payoutMutation.error ? errorMessage(payoutMutation.error) : undefined} />
          {selectedSettlement ? (
            <EntityForm.Section
              title="معاينة الصرف"
              description="المبلغ مستمد من الخادم ويعاد اشتقاقه عند الاعتماد والدفع — لا يمكن تعديله من هنا."
            >
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Metric label="صافي المستحق" value={selectedSettlement.net_payable_amount} tone="success" />
                <Metric label="المحصل" value={selectedSettlement.gross_rent_collected} />
                <Metric label="أتعاب المكتب" value={selectedSettlement.management_fee_amount} tone="primary" />
                <Metric label="المصروفات والضريبة" value={selectedSettlement.owner_expenses + selectedSettlement.fee_vat_amount} tone="danger" />
              </div>
              <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium leading-5 text-muted-foreground">
                سيُصرف مبلغ <strong className="tabular-nums" dir="ltr">{formatMoney(selectedSettlement.net_payable_amount)}</strong> إلى {selectedSettlement.owner_name} عن {selectedSettlement.property_title}
                {' '}({selectedSettlement.period_start} إلى {selectedSettlement.period_end})
                {' '}عبر {payoutMethod === 'bank_transfer' ? 'تحويل بنكي' : payoutMethod === 'check' ? 'شيك مصرفي' : 'نقدًا'}.
              </p>
            </EntityForm.Section>
          ) : null}
          <EntityForm.Section title="بيانات الصرف" description="عند التأكيد تُنشئ قاعدة البيانات قيد مالك مستحق/نقدية متوازنًا.">
            <EntityForm.Field label="وسيلة الصرف *">
              <Select required value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as ProcessPayoutPayload['payout_method'])}>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="check">شيك مصرفي</option>
                <option value="cash">نقدًا</option>
              </Select>
            </EntityForm.Field>
            <EntityForm.Field label="رقم المرجع / المعاملة *">
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
        ? 'text-success'
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
  preview: OwnerSettlementPreview | null;
  previewLoading: boolean;
  previewError: string;
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
  preview,
  previewLoading,
  previewError,
  onSubmit,
}: DraftOverlayProps) {
  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={onOpenChange}
      title="إنشاء مسودة تسوية مالك"
      description="المبالغ تُشتق آليًا من الخادم (التحصيلات المرحّلة، الاتفاقية الحاكمة، المصروفات المعتمدة) وتُحفظ كما تظهر هنا."
      visualVariant="operational"
    >
      <EntityForm.Root onSubmit={onSubmit} aria-busy={isSubmitting}>
        <EntityForm.ErrorSummary message={validationError || (mutationError ? errorMessage(mutationError) : undefined)} />
        <EntityForm.Section title="المالك والعقار" description="لا تظهر إلا الروابط التي لديها اتفاقية إدارة حية.">
          <EntityForm.Field label="اتفاقية المالك والعقار *">
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

        <EntityForm.Section title="الفترة">
          <div className="grid gap-4 sm:grid-cols-2">
            <DraftField label="بداية الفترة *" type="date" value={form.periodStart} onChange={(value) => setForm((current) => ({ ...current, periodStart: value }))} />
            <DraftField label="نهاية الفترة *" type="date" value={form.periodEnd} onChange={(value) => setForm((current) => ({ ...current, periodEnd: value }))} />
          </div>
        </EntityForm.Section>

        <EntityForm.Section
          title="معاينة المبالغ (من الخادم)"
          description="قراءة فقط؛ تُعاد هذه الأرقام نفسها عند الإنشاء والاعتماد والدفع، ولا يمكن تعديلها من هنا."
        >
          {previewLoading ? (
            <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium text-muted-foreground">جارٍ حساب المعاينة من الخادم…</p>
          ) : previewError ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">{previewError}</p>
          ) : preview ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                <Metric label="تحصيلات الفترة" value={preview.gross_collected} />
                <Metric label="أتعاب المكتب" value={preview.office_fee} tone="primary" />
                <Metric label="مصروفات على المالك" value={preview.owner_expenses} tone="danger" />
                <Metric label="ضريبة القيمة المضافة" value={preview.tax_amount} tone="danger" />
                <Metric label="الصافي للمالك" value={preview.net_payable} tone="success" />
              </div>
              <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium text-muted-foreground">
                {`الفترة ${form.periodStart} إلى ${form.periodEnd}`}
                {typeof preview.breakdown?.payments_count === 'number' ? ` · ${preview.breakdown.payments_count} دفعة مرحّلة` : ''}
                {preview.breakdown?.source ? ` · المصدر: ${preview.breakdown.source}` : ''}
                {preview.breakdown?.vat?.enabled
                  ? ` · ضريبة ${preview.breakdown.vat.rate ?? 0}% على أتعاب المكتب`
                  : ' · الضريبة غير مفعّلة لهذه الشركة'}
              </p>
              <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium leading-5 text-muted-foreground">
                عند إنشاء المسودة تُحجز التحصيلات والمصروفات المدرجة ذرّيًا، ولا يمكن سحبها إلى تسوية أخرى لنفس الفترة.
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium text-muted-foreground">
              اختر اتفاقية المالك/العقار وحدد الفترة لعرض المعاينة الخادمية.
            </p>
          )}
          <EntityForm.Field label="ملاحظات" description="اختياري؛ تحفظ داخل التسوية.">
            <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </EntityForm.Field>
        </EntityForm.Section>

        <EntityForm.Actions
          submitLabel={isSubmitting ? 'جارٍ إنشاء المسودة…' : 'إنشاء المسودة'}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitDisabled={!preview || previewLoading}
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

export function SettlementSupervisionBanner({
  settlements,
  canApproveSettlement,
  canPaySettlement,
}: Readonly<{
  settlements: readonly OwnerSettlementRecord[];
  canApproveSettlement: boolean;
  canPaySettlement: boolean;
}>) {
  const hasPending = settlements.some((settlement) => settlement.status === 'pending');
  const hasPaid = settlements.some((settlement) => settlement.status === 'paid');
  const hasApproved = settlements.some((settlement) => settlement.status === 'approved');

  if (settlements.length === 0) return null;

  if (hasPending && !canApproveSettlement) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-info/25 bg-info/10 p-3.5 text-info"
        data-settlement-supervision="needs-admin"
      >
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p className="text-xs font-medium leading-5">
          توجد تسويات بانتظار الاعتماد المالي. الاعتماد والصرف يتطلبان صلاحية المدير/المسؤول — راجع مسؤول النظام لتفعيلها لحسابك.
        </p>
      </div>
    );
  }

  if (!hasPaid && (hasPending || hasApproved) && (canApproveSettlement || canPaySettlement)) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-warning"
        data-settlement-supervision="first-run"
      >
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p className="text-xs font-medium leading-5">
          أول دورة تسويات للمكتب — يُنصح بإشراف المدير/المسؤول على أول اعتماد وصرف والتحقق من بيانات المالك والحساب قبل التنفيذ. هذه ملاحظة تشغيلية فقط ولا تغيّر الصلاحيات.
        </p>
      </div>
    );
  }

  return null;
}
