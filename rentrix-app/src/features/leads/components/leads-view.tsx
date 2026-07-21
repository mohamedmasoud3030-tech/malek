import {
  Archive,
  CheckCircle2,
  Edit,
  Plus,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AsyncContentState } from "@/components/async-content-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { PageLayout } from "@/components/layout/page-layout";
import { WriteErrorCard } from "@/components/page-state-card";
import { Card, CardContent } from "@/components/ui/card";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { EntityForm } from "@/components/ui/entity-form";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { ResponsiveCardGrid } from "@/components/ui/responsive-card-grid";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import type { LeadFilters, LeadFormValues, LeadRecord } from "../types";

const statusLabels: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  qualified: "مؤهل",
  converted: "تم التحويل",
  lost: "مغلق",
  archived: "مؤرشف",
};
const sourceLabels: Record<string, string> = {
  walk_in: "زيارة المكتب",
  phone: "اتصال",
  referral: "ترشيح",
  social: "منصات اجتماعية",
  website: "الموقع",
};
const statusTone: Record<string, "blue" | "green" | "red" | "gray" | "gold"> = {
  new: "blue",
  contacted: "gold",
  qualified: "green",
  converted: "green",
  lost: "red",
  archived: "gray",
};

type Props = Readonly<{
  rows: LeadRecord[];
  filters: LeadFilters;
  draft: LeadFormValues;
  editingLead: LeadRecord | null;
  formOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isArchiving: boolean;
  error: unknown;
  writeError: unknown;
  onFiltersChange: (filters: LeadFilters) => void;
  onDraftChange: (draft: LeadFormValues) => void;
  onCreate: () => void;
  onEdit: (lead: LeadRecord) => void;
  onFormOpenChange: (open: boolean) => void;
  onSubmit: (values: LeadFormValues) => void;
  onArchive: (id: string) => void;
  onRetry: () => void;
}>;

export function LeadsView(props: Props) {
  const {
    rows,
    filters,
    draft,
    editingLead,
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
  } = props;
  const [archiveCandidate, setArchiveCandidate] = useState<LeadRecord | null>(
    null,
  );
  const followUpLeads = rows.filter((row) =>
    ["new", "contacted"].includes(row.status ?? ""),
  ).length;
  const qualifiedLeads = rows.filter(
    (row) => row.status === "qualified",
  ).length;
  const convertedLeads = rows.filter(
    (row) => row.status === "converted",
  ).length;
  const hasFilters =
    filters.query.trim().length > 0 ||
    filters.status !== "all" ||
    filters.source !== "all";
  const listStatus = isLoading
    ? "loading"
    : error
      ? "error"
      : rows.length === 0
        ? "empty"
        : "ready";

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="العملاء المحتملون"
        description="تسجيل مصادر العملاء وحالة المتابعة وربط التحويل لاحقاً بجهات التعامل المناسبة."
        count={isLoading ? "..." : rows.length}
        primaryAction={
          <Button onClick={onCreate}>
            <Plus className="me-2 size-4" />
            إضافة عميل محتمل
          </Button>
        }
      />

      <ResponsiveCardGrid>
        <KpiCard
          label="إجمالي العملاء"
          value={rows.length}
          icon={Users}
          accent="primary"
          sub="كل العملاء المحتملين المسجلين"
        />
        <KpiCard
          label="قيد المتابعة"
          value={followUpLeads}
          icon={UsersRound}
          accent="amber"
          sub="جديد أو تم التواصل معه"
          trend={followUpLeads > 0 ? "neutral" : undefined}
          trendValue={followUpLeads > 0 ? String(followUpLeads) : undefined}
        />
        <KpiCard
          label="عملاء مؤهلون"
          value={qualifiedLeads}
          icon={UserCheck}
          accent="emerald"
          sub="جاهزون للخطوة التالية"
          trend={qualifiedLeads > 0 ? "up" : "neutral"}
          trendValue={String(qualifiedLeads)}
        />
        <KpiCard
          label="تم تحويلهم"
          value={convertedLeads}
          icon={CheckCircle2}
          accent="sky"
          sub="سجلات انتقلت لمسار التعامل"
        />
      </ResponsiveCardGrid>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_12rem_12rem]">
          <Input
            value={filters.query}
            onChange={(event) =>
              onFiltersChange({ ...filters, query: event.target.value })
            }
            placeholder="بحث بالاسم، الهاتف، البريد، نوع الوحدة"
            aria-label="بحث العملاء المحتملين"
          />
          <Select
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({ ...filters, status: event.target.value })
            }
            aria-label="حالة العميل المحتمل"
          >
            <option value="all">كل الحالات</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={filters.source}
            onChange={(event) =>
              onFiltersChange({ ...filters, source: event.target.value })
            }
            aria-label="مصدر العميل المحتمل"
          >
            <option value="all">كل المصادر</option>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {writeError ? (
        <WriteErrorCard
          message={
            writeError instanceof Error
              ? writeError.message
              : "تعذر حفظ التغيير على العميل المحتمل. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى."
          }
        />
      ) : null}

      <AsyncContentState
        status={listStatus}
        error={error}
        errorTitle="تعذر تحميل العملاء المحتملين"
        errorFallbackMessage="راجع الاتصال والصلاحيات ثم أعد المحاولة."
        errorAction={
          <Button variant="secondary" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        }
        emptyTitle={
          hasFilters
            ? "لا يوجد عملاء محتملون ضمن الفلاتر الحالية"
            : "لا يوجد عملاء محتملون بعد"
        }
        emptyDescription={
          hasFilters
            ? "غيّر البحث أو الحالة أو المصدر لعرض عملاء محتملين آخرين."
            : "أضف أول عميل محتمل من بيانات تواصل حقيقية؛ لن ينشئ النظام مستأجراً أو مالكاً تلقائياً."
        }
        emptyAction={
          hasFilters ? undefined : (
            <Button onClick={onCreate}>إضافة عميل محتمل</Button>
          )
        }
      >
        <LeadRows
          rows={rows}
          isArchiving={isArchiving}
          onEdit={onEdit}
          onArchiveClick={setArchiveCandidate}
        />
      </AsyncContentState>

      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={onFormOpenChange}
        title={editingLead ? "تعديل عميل محتمل" : "إضافة عميل محتمل"}
        description="لا يتم إنشاء مستأجر أو مالك تلقائياً؛ التحويل يبقى قراراً تشغيلياً منظماً."
        className="max-w-2xl"
      >
        <EntityForm.Root
          className="md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(draft);
          }}
        >
          <EntityForm.Field label="الاسم">
            <Input
              required
              value={draft.name}
              onChange={(event) =>
                onDraftChange({ ...draft, name: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="الهاتف">
            <Input
              value={draft.phone}
              onChange={(event) =>
                onDraftChange({ ...draft, phone: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="البريد الإلكتروني">
            <Input
              type="email"
              value={draft.email}
              onChange={(event) =>
                onDraftChange({ ...draft, email: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="نوع الوحدة المطلوب">
            <Input
              value={draft.desired_unit_type}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  desired_unit_type: event.target.value,
                })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="المصدر">
            <Select
              value={draft.source}
              onChange={(event) =>
                onDraftChange({ ...draft, source: event.target.value })
              }
            >
              {Object.entries(sourceLabels).map(([value, label]) => (
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
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="أقل ميزانية">
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={draft.min_budget}
              onChange={(event) =>
                onDraftChange({ ...draft, min_budget: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="أعلى ميزانية">
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={draft.max_budget}
              onChange={(event) =>
                onDraftChange({ ...draft, max_budget: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="ملاحظات" className="md:col-span-2">
            <Textarea
              value={draft.notes}
              onChange={(event) =>
                onDraftChange({ ...draft, notes: event.target.value })
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
          if (!open) setArchiveCandidate(null);
        }}
        title={`أرشفة العميل ${archiveCandidate?.name ?? ""}؟`}
        description="سيتم نقل العميل المحتمل إلى الأرشيف ولن يظهر في القوائم النشطة."
        confirmLabel="تأكيد الأرشفة"
        isLoading={isArchiving}
        onConfirm={() => {
          if (archiveCandidate) {
            onArchive(archiveCandidate.id);
            setArchiveCandidate(null);
          }
        }}
      />
    </PageLayout>
  );
}

function LeadRows({
  rows,
  isArchiving,
  onEdit,
  onArchiveClick,
}: Readonly<{
  rows: LeadRecord[];
  isArchiving: boolean;
  onEdit: (row: LeadRecord) => void;
  onArchiveClick: (row: LeadRecord) => void;
}>) {
  const columns: ColumnDef<LeadRecord>[] = [
    {
      key: "name",
      header: "العميل",
      className: "max-w-56",
      render: (row) => (
        <>
          <p className="whitespace-normal break-words font-bold">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.phone ?? row.email ?? "بدون بيانات اتصال"}
          </p>
        </>
      ),
    },
    {
      key: "source",
      header: "المصدر",
      render: (row) => sourceLabels[row.source ?? ""] ?? row.source ?? "—",
    },
    {
      key: "budget",
      header: "الميزانية",
      render: (row) => (
        <span dir="ltr">
          {row.min_budget ?? "—"} - {row.max_budget ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      render: (row) => (
        <StatusBadge tone={statusTone[row.status ?? ""] ?? "gray"}>
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
  ];

  return (
    <EntityTable
      rows={rows}
      columns={columns}
      keyOf={(row) => row.id}
      aria-label="قائمة العملاء المحتملين"
      enableViewModeToggle
      viewModeStorageKey="rentrix:view-mode:leads"
      renderMobileCard={(row) => (
        <LeadCard
          row={row}
          isArchiving={isArchiving}
          onEdit={onEdit}
          onArchiveClick={onArchiveClick}
        />
      )}
    />
  );
}

function LeadCard({
  row,
  isArchiving,
  onEdit,
  onArchiveClick,
}: Readonly<{
  row: LeadRecord;
  isArchiving: boolean;
  onEdit: (row: LeadRecord) => void;
  onArchiveClick: (row: LeadRecord) => void;
}>) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">{row.name}</p>
          <p className="text-sm text-muted-foreground">
            {row.phone ?? row.email ?? "بدون بيانات اتصال"}
          </p>
        </div>
        <StatusBadge tone={statusTone[row.status ?? ""] ?? "gray"}>
          {statusLabels[row.status ?? ""] ?? row.status ?? "—"}
        </StatusBadge>
      </div>
      <p className="mt-3 text-sm">
        المصدر: {sourceLabels[row.source ?? ""] ?? row.source ?? "—"}
      </p>
      <RowActions
        id={row.id}
        disabled={isArchiving}
        onEdit={() => onEdit(row)}
        onArchiveClick={() => onArchiveClick(row)}
      />
    </div>
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
        أرشفة
      </Button>
    </div>
  );
}
