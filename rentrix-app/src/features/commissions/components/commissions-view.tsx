import { useMemo } from 'react';
import { MONEY_STEP } from '@/lib/money';
import {
  Archive,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  Clock3,
  Edit,
  Plus,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { ActiveFilterBar, type ActiveFilterItem } from "@/components/ui/active-filter-bar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageStateCard, WriteErrorCard } from "@/components/page-state-card";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EntityForm } from "@/components/ui/entity-form";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { RegisterMetricStrip } from "@/components/layout/register-summary";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/hooks/useCompanyFormatters";
import { CommissionSourceSelector } from "./CommissionSourceSelector";
import { commissionStatusLabels, commissionTypeLabels, commissionStatusTone, commissionSourceTypeOptions } from "../labels";
import type {
  CommissionFilters,
  CommissionFormValues,
  CommissionRecord,
} from "../types";

function money(value: number | null) {
  if (value == null) return "—";
  return formatMoney(value);
}

function formatSourceLabel(type: string | null, sourceId: string | null): string {
  if (!sourceId) return "بدون مصدر محدد";
  const prefix = commissionTypeLabels[type ?? ""] ?? type ?? "مصدر";
  return sourceId ? `من ${prefix} مرتبط` : 'غير مرتبط بمصدر';
}

/** The single next action available for each lifecycle state. */
const nextActionLabels: Record<string, string> = {
  pending: "التالي: اعتماد",
  approved: "التالي: صرف مالي",
  paid: "التالي: عكس الصرف",
  cancelled: "لا إجراء متاح",
};

type Props = Readonly<{
  rows: CommissionRecord[];
  filters: CommissionFilters;
  draft: CommissionFormValues;
  editingCommission: CommissionRecord | null;
  formOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isArchiving: boolean;
  error: unknown;
  writeError: unknown;
  onFiltersChange: (filters: CommissionFilters) => void;
  onDraftChange: (draft: CommissionFormValues) => void;
  onCreate: () => void;
  onEdit: (commission: CommissionRecord) => void;
  onFormOpenChange: (open: boolean) => void;
  onSubmit: (values: CommissionFormValues) => void;
  onArchive: (id: string) => void;
  onRetry: () => void;
  onApprove?: (commission: CommissionRecord) => void;
  onPayAtomic?: (id: string, paymentDate?: string, accountId?: string) => Promise<unknown>;
  onReverseAtomic?: (id: string, reason: string) => Promise<unknown>;
}>;

export function CommissionsView(props: Props) {
  const {
    rows,
    filters,
    draft,
    editingCommission,
    formOpen,
    isLoading,
    isSaving,
    isArchiving,
    error,
    writeError,
    onFiltersChange,
    onDraftChange,
    onCreate,
    onEdit,
    onFormOpenChange,
    onSubmit,
    onArchive,
    onRetry,
    onPayAtomic,
    onReverseAtomic,
  } = props;
  const [archiveCandidate, setArchiveCandidate] = useState<CommissionRecord | null>(null);
  const [payCandidate, setPayCandidate] = useState<CommissionRecord | null>(null);
  const [reverseCandidate, setReverseCandidate] = useState<CommissionRecord | null>(null);
  const [payAccount, setPayAccount] = useState("1111");
  const [payDate, setPayDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [reverseReason, setReverseReason] = useState("");
  const [isPayPending, setIsPayPending] = useState(false);
  const [isReversePending, setIsReversePending] = useState(false);
  const pendingTotal = rows
    .filter((row) => row.status !== "paid" && row.status !== "cancelled")
    .reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const paidTotal = rows
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const approvedCount = rows.filter((row) => row.status === "approved").length;
  const hasFilters = filters.query.trim().length > 0 || filters.status !== "all" || filters.type !== "all";
  const activeFilters: ActiveFilterItem[] = [];
  if (filters.query.trim()) {
    activeFilters.push({ key: "query", label: "بحث", value: filters.query, onRemove: () => onFiltersChange({ ...filters, query: "" }) });
  }
  if (filters.status !== "all") {
    activeFilters.push({ key: "status", label: "الحالة", value: commissionStatusLabels[filters.status] ?? filters.status, onRemove: () => onFiltersChange({ ...filters, status: "all" }) });
  }
  if (filters.type !== "all") {
    activeFilters.push({ key: "type", label: "النوع", value: commissionTypeLabels[filters.type] ?? filters.type, onRemove: () => onFiltersChange({ ...filters, type: "all" }) });
  }

  const hasCalculatedAmount = Boolean(draft.amount.trim()) || (Boolean(draft.deal_value.trim()) && Number(draft.percentage) > 0);
  const formCanSubmit = Boolean(draft.staff_name.trim()) && hasCalculatedAmount;

  return (
    <section className="space-y-5" data-finance-root>
      <div data-finance-header>
        <PageHeader
          title="العمولات"
          primaryAction={
            <Button onClick={onCreate} className="min-h-11 bg-primary text-primary-foreground">
              <Plus className="me-2 size-4" />
              إضافة عمولة
            </Button>
          }
        />
      </div>

      <section data-finance-section aria-label="ملخص العمولات">
        <RegisterMetricStrip
          aria-label="ملخص العمولات"
          items={[
            { id: 'total', label: 'السجلات', value: rows.length, icon: BadgeDollarSign, hideWhenEmpty: true },
            { id: 'pending', label: 'قيد المراجعة', value: money(pendingTotal), icon: Clock3 },
            { id: 'approved', label: 'معتمدة', value: approvedCount, icon: CheckCircle2, hideWhenEmpty: true },
            { id: 'paid', label: 'مدفوعة', value: money(paidTotal), icon: BadgeDollarSign },
          ]}
        />
      </section>

      <section data-finance-section aria-label="فلاتر العمولات">
        <FilterBar
          searchValue={filters.query}
          onSearchChange={(query) => onFiltersChange({ ...filters, query })}
          searchPlaceholder="بحث بالموظف، المصدر، النوع"
          searchAriaLabel="بحث العمولات"
          filters={
            <>
              <Select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })} aria-label="حالة العمولة" className="min-h-11 w-full sm:w-48">
                <option value="all">كل الحالات</option>
                {Object.entries(commissionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select value={filters.type} onChange={(event) => onFiltersChange({ ...filters, type: event.target.value })} aria-label="نوع العمولة" className="min-h-11 w-full sm:w-48">
                <option value="all">كل الأنواع</option>
                {Object.entries(commissionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </>
          }
        />
        <ActiveFilterBar filters={activeFilters} onClearAll={() => onFiltersChange({ query: "", status: "all", type: "all" })} />
      </section>

      <section data-finance-section aria-label="حالات التحميل والخطأ">
        {error ? <ErrorCard message="تعذر تحميل العمولات" onRetry={onRetry} /> : null}
        {writeError ? (
          <WriteErrorCard message={writeError instanceof Error ? writeError.message : "تعذر حفظ التغيير على العمولة. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى."} />
        ) : null}
        {isLoading ? <PageStateCard title="جارٍ تحميل العمولات..." /> : null}
        {!isLoading && !error && rows.length === 0 ? (
          <PageStateCard
            title={hasFilters ? "لا توجد عمولات ضمن الفلاتر الحالية" : "لا توجد عمولات بعد"}
            description={hasFilters ? "غيّر البحث أو الحالة أو النوع لعرض سجلات عمولات أخرى — الفلاتر محفوظة." : "أضف عمولة تشغيلية عند توفر مصدر ومبلغ حقيقيين. هذه الصفحة للتتبع فقط ولا تنشئ أمر صرف."}
            action={hasFilters ? undefined : <Button onClick={onCreate} className="min-h-11">إضافة عمولة</Button>}
          />
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section data-finance-section aria-label="جدول العمولات">
          <div data-finance-table-wrapper>
            <CommissionRows
              rows={rows}
              isArchiving={isArchiving}
              onEdit={onEdit}
              onArchiveClick={setArchiveCandidate}
              onPayClick={onPayAtomic ? setPayCandidate : undefined}
              onReverseClick={onReverseAtomic ? setReverseCandidate : undefined}
            />
          </div>
        </section>
      ) : null}

      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={onFormOpenChange}
        title={editingCommission ? "تعديل عمولة" : "إضافة عمولة"}
        description="يمكن إدخال مبلغ مباشر أو تركه ليُحسب من قيمة الصفقة ونسبة العمولة للتتبع التشغيلي فقط."
        className="max-w-2xl"
      >
        <EntityForm.Root
          className="md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!formCanSubmit) return;
            onSubmit(draft);
          }}
        >
          <EntityForm.Field label="اسم الموظف / الوسيط *">
            <Input required value={draft.staff_name} onChange={(event) => onDraftChange({ ...draft, staff_name: event.target.value })} />
          </EntityForm.Field>
          <EntityForm.Field label="نوع المصدر">
            <Select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value })}>
              {commissionSourceTypeOptions.map((value) => <option key={value} value={value}>{commissionTypeLabels[value] ?? value}</option>)}
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="الحالة">
            <Select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}>
              {Object.entries(commissionStatusLabels).filter(([val]) => val !== "paid").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="المصدر">
            <CommissionSourceSelector type={draft.type} value={draft.source_id} onChange={(sourceId) => onDraftChange({ ...draft, source_id: sourceId })} />
          </EntityForm.Field>
          <EntityForm.Field label="قيمة الصفقة">
            <Input type="number" min="0" step={MONEY_STEP} inputMode="decimal" dir="ltr" value={draft.deal_value} onChange={(event) => onDraftChange({ ...draft, deal_value: event.target.value })} />
          </EntityForm.Field>
          <EntityForm.Field label="النسبة %">
            <Input type="number" min="0" inputMode="decimal" step="0.01" dir="ltr" value={draft.percentage} onChange={(event) => onDraftChange({ ...draft, percentage: event.target.value })} />
          </EntityForm.Field>
          <EntityForm.Field label="مبلغ مباشر" description="مطلوب إذا لم تدخل قيمة صفقة ونسبة.">
            <Input type="number" min="0" step={MONEY_STEP} inputMode="decimal" dir="ltr" value={draft.amount} onChange={(event) => onDraftChange({ ...draft, amount: event.target.value })} />
          </EntityForm.Field>
          <EntityForm.Actions
            className="md:col-span-2"
            onCancel={() => onFormOpenChange(false)}
            isSubmitting={isSaving}
            submitDisabled={!formCanSubmit}
            submitLabel={isSaving ? "جارٍ الحفظ..." : "حفظ"}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={archiveCandidate != null}
        onOpenChange={(open) => { if (!open && !isArchiving) setArchiveCandidate(null); }}
        title={`إلغاء العمولة لـ ${archiveCandidate?.staff_name ?? ""}؟`}
        description={`سيتم إلغاء العمولة للموظف "${archiveCandidate?.staff_name ?? ""}" — المبلغ: ${money(archiveCandidate?.amount ?? 0)} — الحالة الحالية: ${archiveCandidate?.status ? commissionStatusLabels[archiveCandidate.status] ?? archiveCandidate.status : ''}. لن تُحتسب ضمن المبالغ النشطة ويمكن مراجعتها في الأرشيف.`}
        confirmLabel="تأكيد الإلغاء"
        isLoading={isArchiving}
        onConfirm={async () => {
          if (!archiveCandidate || isArchiving) return;
          try {
            await (onArchive as any)(archiveCandidate.id);
            setArchiveCandidate(null);
          } catch {}
        }}
      />

      <ConfirmDialog
        open={payCandidate != null}
        onOpenChange={(open) => { if (!open && !isPayPending) setPayCandidate(null); }}
        title={`صرف العمولة مالياً لـ ${payCandidate?.staff_name ?? ""}`}
        description={`سيتم إنشاء مصروف مالي وعمل القيود المحاسبية المتزنة من التدفق الخادمي الحالي. المبلغ: ${money(payCandidate?.amount ?? 0)}`}
        confirmLabel="تأكيد الصرف المالي"
        isLoading={isPayPending}
        onConfirm={async () => {
          if (payCandidate && onPayAtomic) {
            setIsPayPending(true);
            try {
              await onPayAtomic(payCandidate.id, payDate, payAccount);
              setPayCandidate(null);
            } finally {
              setIsPayPending(false);
            }
          }
        }}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">الحساب المالي للدفع</label>
            <Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
              <option value="1111">الخزينة النقدية (1111)</option>
              <option value="1201">الحساب البنكي الرئيسي (1201)</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">تاريخ الصرف</label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={reverseCandidate != null}
        onOpenChange={(open) => {
          if (!open && !isReversePending) {
            setReverseCandidate(null);
            setReverseReason("");
          }
        }}
        title={`عكس صرف العمولة لـ ${reverseCandidate?.staff_name ?? ""}`}
        description="سيتم عكس القيود المحاسبية وتغيير حالة المصروف إلى VOID وإلغاء العمولة عبر التدفق الخادمي الحالي. اذكر سبب العكس الإلزامي."
        confirmLabel="تأكيد العكس المحاسبي"
        variant="danger"
        isLoading={isReversePending}
        confirmDisabled={!reverseReason.trim()}
        onConfirm={async () => {
          if (reverseCandidate && onReverseAtomic && reverseReason.trim()) {
            setIsReversePending(true);
            try {
              await onReverseAtomic(reverseCandidate.id, reverseReason.trim());
              setReverseCandidate(null);
              setReverseReason("");
            } finally {
              setIsReversePending(false);
            }
          }
        }}
      >
        <div className="py-2">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">سبب العكس المحاسبي (إلزامي)</label>
          <Input required placeholder="اذكر سبب عكس صرف العمولة..." value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />
        </div>
      </ConfirmDialog>
    </section>
  );
}

function ErrorCard({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <Card role="alert" data-finance-error>
      <CardHeader>
        <CardTitle className="text-sm font-bold text-destructive">{message}</CardTitle>
        <CardDescription>راجع الاتصال والصلاحيات ثم أعد المحاولة.</CardDescription>
        <Button variant="secondary" onClick={onRetry} className="min-h-11">
          <RotateCcw className="me-2 size-4" />
          إعادة المحاولة
        </Button>
      </CardHeader>
    </Card>
  );
}

function CommissionRows({
  rows,
  isArchiving,
  onEdit,
  onArchiveClick,
  onPayClick,
  onReverseClick,
}: Readonly<{
  rows: CommissionRecord[];
  isArchiving: boolean;
  onEdit: (row: CommissionRecord) => void;
  onArchiveClick: (row: CommissionRecord) => void;
  onPayClick?: (row: CommissionRecord) => void;
  onReverseClick?: (row: CommissionRecord) => void;
}>) {
  const actionsFor = (row: CommissionRecord) => (
    <RowActions
      row={row}
      disabled={isArchiving}
      onEdit={() => onEdit(row)}
      onArchiveClick={() => onArchiveClick(row)}
      onPayClick={onPayClick && row.status === 'approved' ? () => onPayClick(row) : undefined}
      onReverseClick={onReverseClick && row.status === 'paid' ? () => onReverseClick(row) : undefined}
    />
  );

  const commissionColumns = useMemo((): ColumnDef<CommissionRecord>[] => [
        {
          key: "staff_name", priority: 'identity' as const,
          header: "المستفيد",
          render: (row) => (
            <span className="max-w-56 whitespace-normal break-words">
              <span className="font-bold">{row.staff_name ?? "—"}</span>
              <p className="text-xs text-muted-foreground">{formatSourceLabel(row.type, row.source_id)}</p>
            </span>
          ),
        },
        { key: "type", priority: 'secondary' as const, header: "النوع", render: (row) => commissionTypeLabels[row.type ?? ""] ?? row.type ?? "—" },
        { key: "amount", priority: 'primary' as const, header: "المبلغ", render: (row) => <span dir="ltr" className="tabular-nums font-bold">{money(row.amount)}</span> },
        {
          key: "status", priority: 'secondary' as const,
          header: "الحالة",
          render: (row) => (
            <span className="flex flex-col items-start gap-1">
              <StatusBadge tone={commissionStatusTone[row.status ?? ""] ?? "neutral"}>{commissionStatusLabels[row.status ?? ""] ?? row.status ?? "—"}</StatusBadge>
              {nextActionLabels[row.status ?? ""] ? <span className="text-xs font-semibold text-muted-foreground">{nextActionLabels[row.status ?? ""]}</span> : null}
            </span>
          ),
        },
        { key: "actions", priority: 'actions' as const, header: "إجراءات", render: actionsFor },
      ], [actionsFor]);

  return (
    <EntityTable
      aria-label="جدول العمولات"
      rows={rows}
      keyOf={(row) => row.id}
      columns={commissionColumns}
    />
  );
}

function RowActions({
  row,
  disabled,
  onEdit,
  onArchiveClick,
  onPayClick,
  onReverseClick,
}: Readonly<{
  row: CommissionRecord;
  disabled: boolean;
  onEdit: () => void;
  onArchiveClick: () => void;
  onPayClick?: () => void;
  onReverseClick?: () => void;
}>) {
  return (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Button className="min-h-11" variant="secondary" onClick={onEdit}>
        <Edit className="me-1 size-4" />تعديل
      </Button>
      {onPayClick ? (
        <Button className="min-h-11" onClick={onPayClick}>
          <Banknote className="me-1 size-4" />صرف مالي
        </Button>
      ) : null}
      {onReverseClick ? (
        <Button className="min-h-11" variant="secondary" onClick={onReverseClick}>
          <Undo2 className="me-1 size-4" />عكس الصرف
        </Button>
      ) : null}
      {row.status !== 'paid' && row.status !== 'cancelled' ? (
        <Button className="min-h-11" variant="danger" disabled={disabled} onClick={onArchiveClick}>
          <Archive className="me-1 size-4" />إلغاء
        </Button>
      ) : null}
    </div>
  );
}