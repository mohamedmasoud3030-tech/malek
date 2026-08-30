import {
  Building2,
  CircleCheck,
  Edit,
  FileSpreadsheet,
  FileText,
  Handshake,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PropertyFormModal } from "./property-form-modal";
import { formatPropertyUnitSummary } from "./property-card-utils";
import { usePropertyListController } from "./use-property-list-controller";
import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { EntityCell } from "@/components/ui/entity-cell";
import { RegisterHeading, RegisterMetricStrip } from "@/components/layout/register-summary";
import { ExportMenu } from "@/components/ui/export-menu";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { getAppLanguageState, translateSharedLabel } from "@/lib/i18n";
import { toast } from "sonner";
import {
  buildPropertiesCsvBlob,
  buildPropertiesCsvFilename,
  buildPropertiesXlsxBlob,
  buildPropertiesXlsxFilename,
} from "./property-list-export";
import { propertyStatusTone, translatePropertyType } from "./components/property-status";
import type { PropertyListItem } from "./property-service";
import { formatCount } from '@/lib/formatters';
import { useAuth } from '@/hooks/use-auth';

const propertyColumnOptions = [
  { key: "title", label: "العقار", locked: true },
  { key: "status", label: "الحالة" },
  { key: "type", label: "النوع" },
  { key: "address", label: "العنوان" },
  { key: "owner", label: "المالك" },
  { key: "units", label: "الوحدات" },
  { key: "workflow", label: "المالك والتشغيل" },
  { key: "actions", label: "الإجراءات", locked: true },
] as const;

const defaultPropertyColumns = propertyColumnOptions.map((column) => column.key);

function PropertyWorkflowStatus({ property }: Readonly<{ property: PropertyListItem }>) {
  const label = property.workflow_health === "ready"
    ? "جاهز للتشغيل"
    : property.workflow_health === "missing_owner"
      ? "يحتاج مالكاً"
      : property.workflow_health === "owner_unavailable"
        ? "المالك غير نشط"
        : "يحتاج اتفاقية";

  const ownerSummary = property.workflow_health === "owner_unavailable"
    ? property.current_owner_name
      ? `المالك المرتبط غير نشط: ${property.current_owner_name}`
      : "سجل المالك المرتبط غير متاح"
    : property.current_owner_name
      ? `المالك: ${property.current_owner_name}`
      : "لا يوجد ربط ملكية ساري";

  return (
    <div className="space-y-1">
      <StatusBadge tone={property.workflow_health === "ready" ? "success" : "warning"}>
        {label}
      </StatusBadge>
      <p className="text-xs text-muted-foreground">{ownerSummary}</p>
    </div>
  );
}

function downloadPropertyFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export type PropertiesListPageProps = Readonly<{
  embedded?: boolean;
}>;

export function PropertiesListPage({ embedded = false }: PropertiesListPageProps) {
  const controller = usePropertyListController();
  const { canAccess } = useAuth();
  const canCreate = canAccess('properties.create');
  const canEdit = canAccess('properties.edit');
  const canArchive = canAccess('properties.archive');
  const canExport = canAccess('properties.view');
  const hasRowActions = canEdit || canArchive;
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultPropertyColumns]);
  const readyCount = controller.properties.filter(
    (property) => property.workflow_health === "ready",
  ).length;
  const linkedOwnerCount = controller.properties.filter(
    (property) => Boolean(property.current_owner_name),
  ).length;
  const attentionCount = controller.properties.length - readyCount;
  const readinessRate = controller.properties.length > 0
    ? Math.round((readyCount / controller.properties.length) * 100)
    : 0;

  const handleExportCsv = () => {
    if (controller.properties.length === 0) {
      toast.error(translateSharedLabel("noResultsHint", getAppLanguageState().language));
      return;
    }
    try {
      downloadPropertyFile(buildPropertiesCsvBlob(controller.properties), buildPropertiesCsvFilename(new Date()));
      toast.success(translateSharedLabel("exportCsv", getAppLanguageState().language));
    } catch (error) {
      console.error("Failed to export properties CSV:", error);
      toast.error("تعذر تصدير ملف CSV");
    }
  };

  const handleExportXlsx = () => {
    if (controller.properties.length === 0) {
      toast.error(translateSharedLabel("noResultsHint", getAppLanguageState().language));
      return;
    }
    try {
      downloadPropertyFile(buildPropertiesXlsxBlob(controller.properties), buildPropertiesXlsxFilename(new Date()));
      toast.success("تم تجهيز ملف Excel");
    } catch (error) {
      console.error("Failed to export properties XLSX:", error);
      toast.error("تعذر تصدير ملف Excel");
    }
  };

  const propertyColumns = useMemo((): ColumnDef<PropertyListItem>[] => [
              {
                key: "title",
                header: "العقار",
                priority: "identity",
                render: (property) => (
                  <EntityCell icon={Building2} title={property.title ?? "—"} />
                ),
              },
              {
                key: "status",
                header: "الحالة",
                priority: "primary",
                render: (property) => (
                  <StatusBadge
                    tone={
                      propertyStatusTone[
                        property.status as keyof typeof propertyStatusTone
                      ] ?? "gray"
                    }
                  >
                    {controller.statusLabels[
                      property.status as keyof typeof controller.statusLabels
                    ] ?? property.status}
                  </StatusBadge>
                ),
              },
              {
                key: "type",
                header: "النوع",
                priority: "detail",
                render: (property) => (
                  <span className="text-sm text-muted-foreground">{translatePropertyType(property.type)}</span>
                ),
              },
              {
                key: "address",
                header: "العنوان",
                priority: "detail",
                render: (property) => (
                  <span className="text-sm text-muted-foreground">
                    {property.address ?? "—"}
                  </span>
                ),
              },
              {
                key: "owner",
                header: "المالك",
                priority: "detail",
                render: (property) => (
                  <span className="text-sm text-muted-foreground">
                    {property.current_owner_name || property.owner_name || "—"}
                  </span>
                ),
              },
              {
                key: "units",
                header: "الوحدات",
                priority: "detail",
                render: (property) => {
                  const units = property.units ?? [];
                  const summary = formatPropertyUnitSummary(
                    units.length,
                    units.filter((unit) => unit.status === "occupied").length,
                  );
                  return (
                    <span className="text-sm tabular-nums text-muted-foreground">{summary.text}</span>
                  );
                },
              },
              {
                key: "workflow",
                header: "المالك والتشغيل",
                priority: "secondary",
                render: (property) => <PropertyWorkflowStatus property={property} />,
              },
              {
                key: "actions",
                header: "إجراءات",
                priority: "actions",
                render: (property) => hasRowActions ? (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {canEdit ? (
                      <Button
                        variant="secondary"
                        className="min-h-11 px-3"
                        aria-label={`تعديل ${property.title ?? "العقار"}`}
                        onClick={() => controller.openEditModal(property.id)}
                      >
                        <Edit className="me-1 size-4" aria-hidden="true" />
                        تعديل
                      </Button>
                    ) : null}
                    {canArchive ? (
                      <Button
                        variant="danger"
                        className="min-h-11 px-3"
                        aria-label={`أرشفة ${property.title ?? "العقار"}`}
                        onClick={() => controller.requestArchive(property.id, property.title ?? "عقار")}
                      >
                        <Trash2 className="me-1 size-4" aria-hidden="true" />
                        أرشفة
                      </Button>
                    ) : null}
                  </div>
                ) : null,
              },
            ], [controller, canEdit, canArchive, hasRowActions]);

  return (
    <>
      <ListPage
        embedded={embedded}
        dir="rtl"
        visualVariant="malek-pro"
        title="العقارات"
        count={controller.totalCount}
        primaryAction={canCreate ? (
          <Button onClick={controller.openCreateModal}>
            <Plus className="me-2 size-4" />
            إضافة عقار
          </Button>
        ) : undefined}
        search={{
          value: controller.search,
          onChange: (value) => {
            controller.setSearch(value);
            controller.setPage(1);
          },
          placeholder: "بحث بالاسم أو العنوان...",
        }}
        filters={
          <Select
            aria-label="الحالة"
            value={controller.status}
            onChange={(event) => {
              controller.setStatus(event.target.value as typeof controller.status);
              controller.setPage(1);
            }}
            className="min-h-11 w-36 shrink-0 rounded-lg"
          >
            <option value="all">كل الحالات</option>
            {controller.statusValues.map((status) => (
              <option key={status} value={status}>
                {controller.statusLabels[status]}
              </option>
            ))}
          </Select>
        }
        activeFilters={controller.activeFilters}
        onClearAllFilters={controller.clearFilters}
        toolbarActions={
          <>
            {canExport ? (
              <ExportMenu
                disabled={controller.properties.length === 0}
                items={[
                  { id: 'xlsx', label: 'ملف Excel', icon: FileSpreadsheet, onClick: handleExportXlsx },
                  { id: 'csv', label: 'ملف CSV', icon: FileText, onClick: handleExportCsv },
                ]}
              />
            ) : null}
            <DataTableColumnsMenu
              columns={propertyColumnOptions}
              visibleKeys={visibleColumnKeys}
              onChange={setVisibleColumnKeys}
            />
          </>
        }
      >
        {!controller.propertiesQuery.isLoading && !controller.propertiesQuery.isError ? (
          <RegisterMetricStrip
            aria-label="ملخص جاهزية العقارات"
            items={[
              { id: 'total', label: 'العقارات', value: formatCount(controller.totalCount), icon: Building2 },
              { id: 'ready', label: 'جاهزة', value: `${formatCount(readinessRate)}%`, hint: `${formatCount(readyCount)} سجل`, icon: CircleCheck, tone: 'success' },
              { id: 'linked', label: 'مرتبطة بمالك', value: formatCount(linkedOwnerCount), icon: Handshake },
              { id: 'attention', label: 'تحتاج متابعة', value: formatCount(attentionCount), icon: TriangleAlert, tone: 'warning', hideWhenEmpty: true },
            ]}
          />
        ) : null}

        <section data-property-register className="min-w-0 space-y-2.5">
          <RegisterHeading title="سجل العقارات" />

          <EntityTable
            aria-label="جدول العقارات"
            rows={controller.properties}
            keyOf={(property) => property.id}
            onRowClick={(property) => controller.navigateToProperty(property.id)}
            visibleColumnKeys={hasRowActions ? visibleColumnKeys : visibleColumnKeys.filter((key) => key !== 'actions')}
            isLoading={controller.propertiesQuery.isLoading}
            error={controller.propertiesQuery.isError ? controller.propertiesQuery.error : null}
            errorTitle="تعذر تحميل قائمة العقارات"
            onRetry={() => controller.propertiesQuery.refetch()}
            emptyTitle={controller.hasFilterValues ? "لا توجد نتائج مطابقة للبحث" : "لم تُضف عقارات بعد"}
            emptyDescription={controller.hasFilterValues ? "جرّب تغيير عوامل البحث أو إزالة الفلتر." : canCreate ? "ابدأ بإضافة أول عقار لك." : "لا توجد عقارات مسجلة الآن."}
            emptyAction={!controller.hasFilterValues && canCreate ? (
              <Button onClick={controller.openCreateModal}>
                <Building2 className="me-2 size-4" />
                إضافة أول عقار
              </Button>
            ) : undefined}
            pagination={{
              page: controller.page,
              pageSize: 10,
              total: controller.totalCount,
              onPageChange: controller.setPage,
            }}
            mobileCardType="property"
            mobileBadgeKey="status"
            mobileSupportingKey="owner"
            mobilePrimaryMetaKeys={["units", "type"]}
            mobileSecondaryMetaKeys={["address"]}
            mobileCardActions={(property) => [
              ...(canEdit ? [{
                label: "تعديل",
                icon: Edit,
                variant: "secondary" as const,
                ariaLabel: `تعديل ${property.title ?? "العقار"}`,
                onClick: () => controller.openEditModal(property.id),
              }] : []),
              ...(canArchive ? [{
                label: "أرشفة",
                icon: Trash2,
                variant: "danger" as const,
                ariaLabel: `أرشفة ${property.title ?? "العقار"}`,
                onClick: () => controller.requestArchive(property.id, property.title ?? "عقار"),
              }] : []),
            ]}
            columns={propertyColumns}
          />
        </section>
      </ListPage>

      {canCreate || canEdit ? (
        <PropertyFormModal
          open={controller.modalOpen}
          onClose={controller.closeModal}
          propertyId={controller.editPropertyId}
        />
      ) : null}

      {canArchive ? (
        <ConfirmDialog
          open={Boolean(controller.archiveTarget)}
          onOpenChange={(open) => {
            if (!open) controller.cancelArchive();
          }}
          title={`أرشفة العقار "${controller.archiveTarget?.title ?? ""}"؟`}
          description="سيتم إخفاء العقار من القوائم النشطة. يمكن التراجع عن هذا لاحقاً من سجل الأرشيف."
          confirmLabel="أرشفة"
          children={(
            <ul className="mt-1 space-y-1.5 text-xs leading-5 text-muted-foreground">
              <li className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />لا يمكن أرشفة عقار يحتوي وحدات غير مؤرشفة — أرشِف الوحدات أولاً.</li>
              <li className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />العقار المرتبط باتفاقية مالك محفوظة لا يُؤرشف؛ استخدم حالة «غير نشط» أو «مباع» للحفاظ على السجل.</li>
              <li className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />لا يمكن الأرشفة مع طلب صيانة مفتوح أو قيد التنفيذ.</li>
              <li className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />لا يمكن أرشفة عقار عليه عقود نشطة.</li>
            </ul>
          )}
          isLoading={controller.isArchiving}
          onConfirm={controller.confirmArchive}
        />
      ) : null}
    </>
  );
}

export function PropertiesWorkspace({ embedded = true }: PropertiesListPageProps) {
  return <PropertiesListPage embedded={embedded} />;
}
