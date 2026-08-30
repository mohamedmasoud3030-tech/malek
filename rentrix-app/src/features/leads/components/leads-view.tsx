import { useMemo } from 'react';
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
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { AsyncContentState } from "@/components/async-content-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmbeddableWorkspace } from "@/components/layout/embeddable-workspace";
import { WriteErrorCard } from "@/components/ui/error-state";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { EntityForm } from "@/components/ui/entity-form";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { ResponsiveCardGrid } from "@/components/ui/responsive-card-grid";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import type { LeadFilters, LeadFormValues, LeadRecord } from "../types";

import { leadStatusLabels, leadSourceLabels, leadStatusTone } from "../labels";

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
  embedded?: boolean;
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
    embedded = false,
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
      key: "status", label: "الحالة",
      value: leadStatusLabels[filters.status] ?? filters.status,
      onRemove: () => onFiltersChange({ ...filters, status: "all" }),
    });
  }
  if (filters.source !== "all") {
    activeFilters.push({
      key: "source", label: "المصدر",
      value: leadSourceLabels[filters.source] ?? filters.source,
      onRemove: () => onFiltersChange({ ...filters, source: "all" }),
    });
  }
  const listStatus = isLoading
    ? "loading"
    : error
      ? "error"
      : rows.length === 0
        ? "empty"
        : "ready";

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      dir="rtl"
      lang="ar"
      title="العملاء المحتملون"
      description="تسجيل مصادر العملاء وحالة المتابعة وربط التحويل لاحقاً بجهات التعامل المناسبة."
      count={isLoading ? "..." : rows.length}
      primaryAction={
        <Button onClick={onCreate}>
          <Plus className="me-2 size-4" />
          إضافة عميل محتمل
        </Button>
      }
    >

      <ResponsiveCardGrid desktopColumns={4}>
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

      <FilterBar
        searchValue={filters.query}
        onSearchChange={(query) => onFiltersChange({ ...filters, query })}
        searchPlaceholder="بحث بالاسم، الهاتف، البريد، نوع الوحدة"
        searchAriaLabel="بحث العملاء المحتملين"
        filters={
          <>
            <Select
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({ ...filters, status: event.target.value })
              }
              aria-label="حالة العميل المحتمل"
              className="w-full sm:w-48"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(leadStatusLabels).map(([value, label]) => (
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
              className="w-full sm:w-48"
            >
              <option value="all">كل المصادر</option>
              {Object.entries(leadSourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </>
        }

        activeFilters={activeFilters}
        onClearAllFilters={() => onFiltersChange({ query: "", status: "all", source: "all" })}
      />


      {writeError ? (
        <WriteErrorCard
          error={writeError}
          fallbackMessage="تعذر حفظ التغيير على العميل المحتمل. راجع الصلاحيات أو الاتصال ثم حاول مرة أخرى."
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
              {Object.entries(leadSourceLabels).map(([value, label]) => (
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
              {Object.entries(leadStatusLabels).map(([value, label]) => (
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
          if (!open && !isArchiving) setArchiveCandidate(null);
        }}
        title={`أرشفة العميل ${archiveCandidate?.name ?? ""}؟`}
        description={`سيتم أرشفة العميل "${archiveCandidate?.name ?? ""}" وإخفاؤه من القوائم النشطة مع الاحتفاظ بتاريخ المتابعة والعلاقات.`}
        confirmLabel="تأكيد الأرشفة"
        isLoading={isArchiving}
        onConfirm={async () => {
          if (!archiveCandidate || isArchiving) return;
          try {
            await (onArchive as any)(archiveCandidate.id);
            setArchiveCandidate(null);
          } catch {
            // keep dialog open on failure
          }
        }}
      />
    </EmbeddableWorkspace>
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
  const columns = useMemo((): ColumnDef<LeadRecord>[] => [
    {
      key: "name", priority: 'identity' as const,
      header: "العميل",
      className: "min-w-0 max-w-56",
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
      key: "source", priority: 'secondary' as const,
      header: "المصدر",
      render: (row) => leadSourceLabels[row.source ?? ""] ?? row.source ?? "—",
    },
    {
      key: "budget", priority: 'detail' as const,
      header: "الميزانية",
      render: (row) => (
        <span dir="ltr">
          {row.min_budget ?? "—"} - {row.max_budget ?? "—"}
        </span>
      ),
    },
    {
      key: "status", priority: 'primary' as const,
      header: "الحالة",
      render: (row) => (
        <StatusBadge tone={leadStatusTone[row.status ?? ""] ?? "neutral"}>
          {leadStatusLabels[row.status ?? ""] ?? row.status ?? "—"}
        </StatusBadge>
      ),
    },
    {
      key: "actions", priority: 'actions' as const,
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
  ], [onEdit, onArchiveClick]);

  return (
    <EntityTable
      rows={rows}
      columns={columns}
      keyOf={(row) => row.id}
      aria-label="قائمة العملاء المحتملين"
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
    <div className="flex">
      <ActionMenu
        label={`إجراءات العميل ${id}`}
        items={[
          { id: 'edit', label: 'تعديل', icon: Edit, onClick: onEdit },
          { id: 'archive', label: 'أرشفة', icon: Archive, danger: true, disabled, onClick: onArchiveClick },
        ]}
      />
    </div>
  );
}
