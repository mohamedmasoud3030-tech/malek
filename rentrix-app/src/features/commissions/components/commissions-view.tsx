import {
  Archive,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  Edit,
  Plus,
  RotateCcw,
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
import { EntityTable } from "@/components/ui/entity-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { ResponsiveCardGrid } from "@/components/ui/responsive-card-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/hooks/useCompanyFormatters";
import { CommissionSourceSelector } from "./CommissionSourceSelector";
import type {
  CommissionFilters,
  CommissionFormValues,
  CommissionRecord,
} from "../types";

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمدة للتتبع",
  paid: "مسجلة كمدفوعة",
  cancelled: "ملغاة",
};
const typeLabels: Record<string, string> = {
  contract: "عقد",
  payment: "تحصيل",
  owner: "مالك",
  lead: "عميل محتمل",
  land: "أرض",
};
const statusTone: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  pending: "warning",
  approved: "info",
  paid: "success",
  cancelled: "danger",
};

function money(value: number | null) {
  if (value == null) return "—";
  return formatMoney(value);
}

/**
 * Formats the commission source reference as a readable label.
 * Never exposes raw UUIDs as primary labels.
 */
function formatSourceLabel(type: string | null, sourceId: string | null): string {
  if (!sourceId) return "بدون مصدر";
  const prefix = typeLabels[type ?? ""] ?? type ?? "مصدر";
  return `${prefix} #${sourceId.slice(0, 8)}`;
}

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
    onApprove,
    onPayAtomic,
    onReverseAtomic,
  } = props;
  const [archiveCandidate, setArchiveCandidate] =
    useState<CommissionRecord | null>(null);
  const [payCandidate, setPayCandidate] =
    useState<CommissionRecord | null>(null);
  const [reverseCandidate, setReverseCandidate] =
    useState<CommissionRecord | null>(null);
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
  const hasFilters =
    filters.query.trim().length > 0 ||
    filters.status !== "all" ||
    filters.type !== "all";
  const activeFilters: ActiveFilterItem[] = [];
  if (filters.query.trim()) {
    activeFilters.push({
      key: "query",
      label: "بحث",
      value: filters.query,
      onRemove: () => onFiltersChange({ ...filters, query: "" }),
    });
  }
  if (filters.status !== "all") {
    activeFilters.push({
      key: "status",
      label: "الحالة",
      value: statusLabels[filters.status] ?? filters.status,
      onRemove: () => onFiltersChange({ ...filters, status: "all" }),
    });
  }
  if (filters.type !== "all") {
    activeFilters.push({
      key: "type",
      label: "النوع",
      value: typeLabels[filters.type] ?? filters.type,
      onRemove: () => onFiltersChange({ ...filters, type: "all" }),
    });
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="العمولات"
        description="تتبع تشغيلي لعمولات المكتب والوسطاء حسب الحالة والمصدر، ولا يعتمد صرفاً أو مطابقة مالية."
        action={
          <Button onClick={onCreate}>
            <Plus className="me-2 size-4" />
            إضافة عمولة
          </Button>
        }
      />
      <ResponsiveCardGrid>
        <KpiCard
          label="إجمالي السجلات"
          value={rows.length}
          icon={BadgeDollarSign}
          accent="primary"
        />
        <KpiCard
          label="قيد المراجعة/التتبع"
          value={money(pendingTotal)}
          icon={Clock3}
          accent="amber"
        />
        <KpiCard
          label="معتمدة للتتبع"
          value={approvedCount}
          icon={CheckCircle2}
          accent="sky"
        />
        <KpiCard
          label="مسجلة كمدفوعة"
          value={money(paidTotal)}
          icon={BadgeDollarSign}
          accent="emerald"
        />
      </ResponsiveCardGrid>

      <FilterBar
        searchValue={filters.query}
        onSearchChange={(query) => onFiltersChange({ ...filters, query })}
        searchPlaceholder="بحث بالموظف، المصدر، النوع"
        searchAriaLabel="بحث العمولات"
        filters={
          <>
            <Select
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({ ...filters, status: event.target.value })
              }
              aria-label="حالة العمولة"
              className="w-full sm:w-48"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={filters.type}
              onChange={(event) =>
                onFiltersChange({ ...filters, type: event.target.value })
              }
              aria-label="نوع العمولة"
              className="w-full sm:w-48"
            >
              <option value="all">كل الأنواع</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </>
        }
      />
      <ActiveFilterBar
        filters={activeFilters}
        onClearAll={() =>
          onFiltersChange({ query: "", status: "all", type: "all" })
        }
      />

      {error ? (
        <ErrorCard message="تعذر تحميل العمولات" onRetry={onRetry} />
      ) : null}
      {writeError ? (
        <WriteErrorCard
          message={
            writeError instanceof Error
              ? writeError.message
              : "تعذر حفظ التغيير على العمولة. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى."
          }
        />
      ) : null}
      {isLoading ? <PageStateCard title="جارٍ تحميل العمولات..." /> : null}
      {!isLoading && !error && rows.length === 0 ? (
        <PageStateCard
          title={
            hasFilters
              ? "لا توجد عمولات ضمن الفلاتر الحالية"
              : "لا توجد عمولات بعد"
          }
          description={
            hasFilters
              ? "غيّر البحث أو الحالة أو النوع لعرض سجلات عمولات أخرى."
              : "أضف عمولة تشغيلية عند توفر مصدر ومبلغ حقيقيين. هذه الصفحة للتتبع فقط ولا تنشئ أمر صرف."
          }
          action={
            hasFilters ? undefined : (
              <Button onClick={onCreate}>إضافة عمولة</Button>
            )
          }
        />
      ) : null}
      {rows.length > 0 ? (
        <CommissionRows
          rows={rows}
          isArchiving={isArchiving}
          onEdit={onEdit}
          onArchiveClick={setArchiveCandidate}
        />
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
            onSubmit(draft);
          }}
        >
          <EntityForm.Field label="اسم الموظف / الوسيط">
            <Input
              required
              value={draft.staff_name}
              onChange={(event) =>
                onDraftChange({ ...draft, staff_name: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="نوع المصدر">
            <Select
              value={draft.type}
              onChange={(event) =>
                onDraftChange({ ...draft, type: event.target.value })
              }
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="الحالة">
            <Select
              value={draft.status}
              onChange={(event) =>
                onDraftChange({ ...draft, status: event.target.value })
              }
            >
              {Object.entries(statusLabels)
                .filter(([val]) => val !== "paid")
                .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="المصدر">
            <CommissionSourceSelector
              type={draft.type}
              value={draft.source_id}
              onChange={(sourceId) =>
                onDraftChange({ ...draft, source_id: sourceId })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="قيمة الصفقة">
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={draft.deal_value}
              onChange={(event) =>
                onDraftChange({ ...draft, deal_value: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="النسبة %">
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              step="0.01"
              value={draft.percentage}
              onChange={(event) =>
                onDraftChange({ ...draft, percentage: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="مبلغ مباشر">
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) =>
                onDraftChange({ ...draft, amount: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Actions
            className="md:col-span-2"
            onCancel={() => onFormOpenChange(false)}
            isSubmitting={isSaving}
            submitLabel={isSaving ? "جارٍ الحفظ..." : "حفظ"}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={archiveCandidate != null}
        onOpenChange={(open) => {
          if (!open && !isArchiving) setArchiveCandidate(null);
        }}
        title={`إلغاء العمولة لـ ${archiveCandidate?.staff_name ?? ""}؟`}
        description={`سيتم إلغاء العمولة للموظف "${archiveCandidate?.staff_name ?? ""}" — المرجع: ${archiveCandidate?.id ? archiveCandidate.id.slice(0, 8) : ''} — المبلغ: ${money(archiveCandidate?.amount ?? 0)} — الحالة الحالية: ${archiveCandidate?.status ? statusLabels[archiveCandidate.status] ?? archiveCandidate.status : ''}. لن تُحتسب ضمن المبالغ النشطة ويمكن مراجعتها في الأرشيف.`}
        confirmLabel="تأكيد الإلغاء"
        isLoading={isArchiving}
        onConfirm={async () => {
          if (!archiveCandidate || isArchiving) return;
          try {
            await (onArchive as any)(archiveCandidate.id);
            setArchiveCandidate(null);
          } catch {
            // preserve dialog on failure
          }
        }}
      />

      <ConfirmDialog
        open={payCandidate != null}
        onOpenChange={(open) => {
          if (!open) setPayCandidate(null);
        }}
        title={`صرف العمولة مالياً لـ ${payCandidate?.staff_name ?? ""}`}
        description={`سيتم إنشاء مصروف مالي (حساب 6100) وخصم المبلغ من الحساب النقدي/البنكي المحدد وعمل القيود المحاسبية المتزنة. المبلغ: ${money(payCandidate?.amount ?? 0)}`}
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
            <label className="block text-xs font-semibold text-muted-foreground mb-1">الحساب المالي للدفع</label>
            <Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
              <option value="1111">الخزينة النقدية (1111)</option>
              <option value="1201">الحساب البنكي الرئيسي (1201)</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">تاريخ الصرف</label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={reverseCandidate != null}
        onOpenChange={(open) => {
          if (!open) {
            setReverseCandidate(null);
            setReverseReason("");
          }
        }}
        title={`عكس صرف العمولة لـ ${reverseCandidate?.staff_name ?? ""}`}
        description="سيتم عكس القيود المحاسبية (دائن مصروفات عمولات، مدين نقدية/بنك) وتغيير حالة المصروف إلى VOID وإلغاء العمولة. اذكر سبب العكس الإلزامي."
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
          <label className="block text-xs font-semibold text-muted-foreground mb-1">سبب العكس المحاسبي (إلزامي)</label>
          <Input
            placeholder="اذكر سبب عكس صرف العمولة..."
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}

function ErrorCard({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle>{message}</CardTitle>
        <CardDescription>
          راجع الاتصال والصلاحيات ثم أعد المحاولة.
        </CardDescription>
        <Button variant="secondary" onClick={onRetry}>
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
}: Readonly<{
  rows: CommissionRecord[];
  isArchiving: boolean;
  onEdit: (row: CommissionRecord) => void;
  onArchiveClick: (row: CommissionRecord) => void;
}>) {
  return (
    <EntityTable
      aria-label="جدول العمولات"
      rows={rows}
      keyOf={(row) => row.id}
      columns={[
        {
          key: "staff_name",
          header: "المستفيد",
          render: (row) => (
            <span className="max-w-56 whitespace-normal break-words">
              <span className="font-bold">{row.staff_name ?? "—"}</span>
              <p className="text-xs text-muted-foreground">
                {formatSourceLabel(row.type, row.source_id)}
              </p>
            </span>
          ),
        },
        {
          key: "type",
          header: "النوع",
          render: (row) => typeLabels[row.type ?? ""] ?? row.type ?? "—",
        },
        { key: "amount", header: "المبلغ", render: (row) => money(row.amount) },
        {
          key: "status",
          header: "الحالة",
          render: (row) => (
            <StatusBadge tone={statusTone[row.status ?? ""] ?? "neutral"}>
              {statusLabels[row.status ?? ""] ?? row.status ?? "—"}
            </StatusBadge>
          ),
        },
        {
          key: "actions",
          header: "إجراءات",
          render: (row) => (
            <RowActions
              id={row.id}
              disabled={isArchiving}
              onEdit={() => onEdit(row)}
              onArchiveClick={() => onArchiveClick(row)}
            />
          ),
        },
      ]}
      enableViewModeToggle
      viewModeStorageKey="rentrix:view-mode:commissions"
      renderMobileCard={(row) => (
        <div className="rounded-2xl border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black">{row.staff_name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">
                {typeLabels[row.type ?? ""] ?? row.type ?? "—"}
              </p>
            </div>
            <StatusBadge tone={statusTone[row.status ?? ""] ?? "neutral"}>
              {statusLabels[row.status ?? ""] ?? row.status ?? "—"}
            </StatusBadge>
          </div>
          <p className="mt-3 text-sm">المبلغ: {money(row.amount)}</p>
          <RowActions
            id={row.id}
            disabled={isArchiving}
            onEdit={() => onEdit(row)}
            onArchiveClick={() => onArchiveClick(row)}
          />
        </div>
      )}
    />
  );
}

function RowActions({
  id,
  disabled,
  onEdit,
  onArchiveClick,
}: Readonly<{
  id: string;
  disabled: boolean;
  onEdit: () => void;
  onArchiveClick: () => void;
}>) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button className="min-h-11" variant="secondary" onClick={onEdit}>
        <Edit className="me-2 size-4" />
        تعديل
      </Button>
      <Button
        className="min-h-11"
        variant="danger"
        disabled={disabled}
        onClick={onArchiveClick}
      >
        <Archive className="me-2 size-4" />
        إلغاء
      </Button>
    </div>
  );
}
