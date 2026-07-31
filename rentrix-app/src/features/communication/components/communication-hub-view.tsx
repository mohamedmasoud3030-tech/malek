import {
  Archive,
  CheckCircle2,
  Edit,
  RotateCcw,
  Rows3,
  UserRoundSearch,
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
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { EntityForm } from "@/components/ui/entity-form";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { ResponsiveCardGrid } from "@/components/ui/responsive-card-grid";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import type {
  CommunicationFilters,
  CommunicationFormValues,
  CommunicationRecord,
} from "../types";

const channelLabels: Record<string, string> = {
  phone: "هاتف",
  whatsapp: "واتساب مسجل",
  email: "بريد إلكتروني",
  meeting: "اجتماع",
  note: "ملاحظة تشغيلية",
};
const directionLabels: Record<string, string> = {
  inbound: "وارد",
  outbound: "صادر",
  internal: "تشغيلي",
};
const statusLabels: Record<string, string> = {
  logged: "مسجل",
  follow_up: "متابعة مطلوبة",
  resolved: "مغلق",
  archived: "مؤرشف",
};
const statusTone: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  logged: "info",
  follow_up: "warning",
  resolved: "success",
  archived: "neutral",
};

type Props = Readonly<{
  rows: CommunicationRecord[];
  filters: CommunicationFilters;
  draft: CommunicationFormValues;
  editingRecord: CommunicationRecord | null;
  formOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isArchiving: boolean;
  error: unknown;
  writeError: unknown;
  onFiltersChange: (filters: CommunicationFilters) => void;
  onDraftChange: (draft: CommunicationFormValues) => void;
  onCreate: () => void;
  onEdit: (record: CommunicationRecord) => void;
  onFormOpenChange: (open: boolean) => void;
  onSubmit: (values: CommunicationFormValues) => void;
  onArchive: (id: string) => void;
  onRetry: () => void;
}>;

export function CommunicationHubView(props: Props) {
  const {
    rows,
    filters,
    draft,
    editingRecord,
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
  const [archiveCandidate, setArchiveCandidate] =
    useState<CommunicationRecord | null>(null);
  const followUps = rows.filter((row) => row.status === "follow_up").length;
  const resolved = rows.filter((row) => row.status === "resolved").length;
  const archived = rows.filter((row) => row.status === "archived").length;
  const hasFilters =
    filters.query.trim().length > 0 ||
    filters.channel !== "all" ||
    filters.status !== "all";
  const activeFilters: ActiveFilterItem[] = [];
  if (filters.query.trim()) {
    activeFilters.push({
      key: "query",
      label: "بحث",
      value: filters.query,
      onRemove: () => onFiltersChange({ ...filters, query: "" }),
    });
  }
  if (filters.channel !== "all") {
    activeFilters.push({
      key: "channel",
      label: "القناة",
      value: channelLabels[filters.channel] ?? filters.channel,
      onRemove: () => onFiltersChange({ ...filters, channel: "all" }),
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
  const showRows = !isLoading && !error && rows.length > 0;
  const showEmpty = !isLoading && !error && rows.length === 0;

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <div className="max-w-3xl">
          <h2 className="text-base font-bold tracking-tight">سجل التواصل</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            سجل تشغيلي للمكالمات والرسائل والاجتماعات. لا يرسل رسائل خارجية ولا
            يستدعي مزودين مدفوعين.
          </p>
        </div>
        <ResponsiveCardGrid>
          <KpiCard
            label="إجمالي السجلات"
            value={rows.length}
            icon={Rows3}
            accent="primary"
            compact
          />
          <KpiCard
            label="متابعة مطلوبة"
            value={followUps}
            icon={UserRoundSearch}
            accent="amber"
            compact
          />
          <KpiCard
            label="مغلقة"
            value={resolved}
            icon={CheckCircle2}
            accent="emerald"
            compact
          />
          <KpiCard
            label="مؤرشفة"
            value={archived}
            icon={Archive}
            accent="sky"
            compact
          />
        </ResponsiveCardGrid>
      </div>

      <FilterBar
        searchValue={filters.query}
        onSearchChange={(query) => onFiltersChange({ ...filters, query })}
        searchPlaceholder="بحث بالاسم، الهاتف، الموضوع، المحتوى"
        searchAriaLabel="بحث سجل التواصل"
        filters={
          <>
            <Select
              value={filters.channel}
              onChange={(event) =>
                onFiltersChange({ ...filters, channel: event.target.value })
              }
              aria-label="قناة التواصل"
              className="w-full sm:w-48"
            >
              <option value="all">كل القنوات</option>
              {Object.entries(channelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({ ...filters, status: event.target.value })
              }
              aria-label="حالة التواصل"
              className="w-full sm:w-48"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(statusLabels).map(([value, label]) => (
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
        onClearAll={() => onFiltersChange({ query: "", channel: "all", status: "all" })}
      />

      {error ? (
        <ErrorCard message="تعذر تحميل سجل التواصل" onRetry={onRetry} />
      ) : null}
      {writeError ? (
        <WriteErrorCard
          message={
            writeError instanceof Error
              ? writeError.message
              : "تعذر حفظ التغيير على سجل التواصل. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى."
          }
        />
      ) : null}
      {isLoading ? <PageStateCard title="جارٍ تحميل سجل التواصل..." /> : null}
      {showEmpty ? (
        <PageStateCard
          title={
            hasFilters
              ? "لا توجد سجلات تواصل ضمن الفلاتر الحالية"
              : "لا توجد سجلات تواصل بعد"
          }
          description={
            hasFilters
              ? "غيّر البحث أو القناة أو الحالة لعرض سجلات تواصل أخرى."
              : "أضف أول سجل تشغيلي عند حدوث اتصال أو اجتماع أو ملاحظة. لا يتم إرسال أي رسالة خارجية."
          }
          action={
            hasFilters ? undefined : (
              <Button onClick={onCreate}>إضافة سجل تواصل</Button>
            )
          }
        />
      ) : null}
      {showRows ? (
        <CommunicationRows
          rows={rows}
          isArchiving={isArchiving}
          onEdit={onEdit}
          onArchiveClick={setArchiveCandidate}
        />
      ) : null}

      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={onFormOpenChange}
        title={editingRecord ? "تعديل سجل تواصل" : "إضافة سجل تواصل"}
        description="هذا تسجيل تشغيلي فقط، ولن يرسل النظام أي رسالة خارجية عند الحفظ."
        className="max-w-2xl"
      >
        <EntityForm.Root
          className="md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(draft);
          }}
        >
          <EntityForm.Field label="اسم جهة التواصل">
            <Input
              required
              value={draft.contact_name}
              onChange={(event) =>
                onDraftChange({ ...draft, contact_name: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="الهاتف">
            <Input
              value={draft.contact_phone ?? ""}
              onChange={(event) =>
                onDraftChange({ ...draft, contact_phone: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="البريد الإلكتروني">
            <Input
              type="email"
              value={draft.contact_email ?? ""}
              onChange={(event) =>
                onDraftChange({ ...draft, contact_email: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="الموضوع">
            <Input
              value={draft.subject ?? ""}
              onChange={(event) =>
                onDraftChange({ ...draft, subject: event.target.value })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="القناة">
            <Select
              value={draft.channel}
              onChange={(event) =>
                onDraftChange({ ...draft, channel: event.target.value as CommunicationFormValues['channel'] })
              }
            >
              {Object.entries(channelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="الاتجاه">
            <Select
              value={draft.direction}
              onChange={(event) =>
                onDraftChange({ ...draft, direction: event.target.value as CommunicationFormValues['direction'] })
              }
            >
              {Object.entries(directionLabels).map(([value, label]) => (
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
                onDraftChange({ ...draft, status: event.target.value as CommunicationFormValues['status'] })
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="نوع الربط">
            <Input
              value={draft.related_entity_type ?? ""}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  related_entity_type: event.target.value,
                })
              }
              placeholder="مستأجر، مالك، عقد، أو اتركه فارغاً"
            />
          </EntityForm.Field>
          <EntityForm.Field label="معرف الربط">
            <Input
              value={draft.related_entity_id ?? ""}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  related_entity_id: event.target.value,
                })
              }
            />
          </EntityForm.Field>
          <EntityForm.Field label="المحتوى" className="md:col-span-2">
            <Textarea
              required
              value={draft.body}
              onChange={(event) =>
                onDraftChange({ ...draft, body: event.target.value })
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
        title={`أرشفة سجل التواصل مع ${archiveCandidate?.contact_name ?? ""}؟`}
        description="سيتم نقل سجل التواصل إلى الأرشيف ولن يظهر في القوائم النشطة."
        confirmLabel="تأكيد الأرشفة"
        isLoading={isArchiving}
        onConfirm={() => {
          if (archiveCandidate) {
            onArchive(archiveCandidate.id);
            setArchiveCandidate(null);
          }
        }}
      />
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

function CommunicationRows({
  rows,
  isArchiving,
  onEdit,
  onArchiveClick,
}: Readonly<{
  rows: CommunicationRecord[];
  isArchiving: boolean;
  onEdit: (row: CommunicationRecord) => void;
  onArchiveClick: (row: CommunicationRecord) => void;
}>) {
  const columns: ColumnDef<CommunicationRecord>[] = [
    {
      key: "contact",
      header: "جهة التواصل",
      className: "max-w-56",
      render: (row) => (
        <>
          <p className="whitespace-normal break-words font-bold">
            {row.contact_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.contact_phone ?? row.contact_email ?? "بدون بيانات اتصال"}
          </p>
        </>
      ),
    },
    {
      key: "channel",
      header: "النوع والاتجاه",
      render: (row) => (
        <>
          {channelLabels[row.channel] ?? row.channel}
          <p className="text-xs text-muted-foreground">
            {directionLabels[row.direction] ?? row.direction}
          </p>
        </>
      ),
    },
    {
      key: "context",
      header: "السياق",
      className: "max-w-72",
      render: (row) => (
        <>
          <span className="whitespace-normal break-words">
            {row.subject ?? row.body.slice(0, 48)}
          </span>
          <p className="text-xs text-muted-foreground">
            {formatRelatedContext(row)}
          </p>
        </>
      ),
    },
    {
      key: "updated_at",
      header: "آخر تحديث",
      render: (row) => (
        <span className="tabular-nums" dir="ltr">
          {formatCommunicationTimestamp(row.updated_at ?? row.created_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      render: (row) => (
        <StatusBadge tone={statusTone[row.status] ?? "neutral"}>
          {statusLabels[row.status] ?? row.status}
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
      aria-label="سجلات التواصل"
      enableViewModeToggle
      viewModeStorageKey="rentrix:view-mode:communication"
      renderMobileCard={(row) => (
        <CommunicationCard
          row={row}
          isArchiving={isArchiving}
          onEdit={onEdit}
          onArchiveClick={onArchiveClick}
        />
      )}
    />
  );
}

function CommunicationCard({
  row,
  isArchiving,
  onEdit,
  onArchiveClick,
}: Readonly<{
  row: CommunicationRecord;
  isArchiving: boolean;
  onEdit: (row: CommunicationRecord) => void;
  onArchiveClick: (row: CommunicationRecord) => void;
}>) {
  return (
    <div className="rounded-2xl border bg-background p-4" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black">{row.contact_name}</p>
          <p className="text-sm text-muted-foreground">
            {channelLabels[row.channel] ?? row.channel} ·{" "}
            {directionLabels[row.direction] ?? row.direction}
          </p>
        </div>
        <StatusBadge tone={statusTone[row.status] ?? "neutral"}>
          {statusLabels[row.status] ?? row.status}
        </StatusBadge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm">{row.subject ?? row.body}</p>
      <div className="mt-3 grid gap-1 text-xs font-bold text-muted-foreground">
        <span>{formatRelatedContext(row)}</span>
        <time dateTime={row.updated_at ?? row.created_at} dir="ltr">
          {formatCommunicationTimestamp(row.updated_at ?? row.created_at)}
        </time>
      </div>
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

function formatRelatedContext(row: CommunicationRecord) {
  if (!row.related_entity_type && !row.related_entity_id)
    return "بدون ربط بملف محدد";
  return [row.related_entity_type, row.related_entity_id]
    .filter(Boolean)
    .join(" · ");
}

function formatCommunicationTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
