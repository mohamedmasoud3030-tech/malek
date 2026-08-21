import {
  Building2,
  CircleCheck,
  Download,
  Edit,
  Handshake,
  MapPin,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { PropertyFormModal } from "./property-form-modal";
import { usePropertyListController } from "./use-property-list-controller";
import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { EntityCell } from "@/components/ui/entity-cell";
import { OperationalCommandPanel, OperationalMetricCard } from "@/components/ui/operational-summary";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActiveFilterBar } from "@/components/ui/active-filter-bar";
import { EntityTable } from "@/components/ui/entity-table";
import { ActionMenu } from "@/components/ui/action-menu";
import { getAppLanguageState, translateSharedLabel } from "@/lib/i18n";
import { toast } from "sonner";
import {
  buildPropertiesCsvBlob,
  buildPropertiesCsvFilename,
} from "./property-list-export";
import { propertyStatusTone } from "./components/property-status";
import type { PropertyListItem } from "./property-service";

const propertyColumnOptions = [
  { key: "title", label: "العقار", locked: true },
  { key: "status", label: "الحالة" },
  { key: "workflow", label: "المالك والتشغيل" },
  { key: "address", label: "العنوان" },
  { key: "actions", label: "الإجراءات", locked: true },
] as const;

const defaultPropertyColumns = propertyColumnOptions.map((column) => column.key);

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

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

export type PropertiesListPageProps = Readonly<{
  embedded?: boolean;
}>;

export function PropertiesListPage({ embedded = false }: PropertiesListPageProps) {
  const controller = usePropertyListController();
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
      toast.error(
        translateSharedLabel("noResultsHint", getAppLanguageState().language),
      );
      return;
    }
    try {
      const url = URL.createObjectURL(buildPropertiesCsvBlob(controller.properties));
      const link = document.createElement("a");
      link.href = url;
      link.download = buildPropertiesCsvFilename(new Date());
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success(
        translateSharedLabel("exportCsv", getAppLanguageState().language),
      );
    } catch (error) {
      console.error("Failed to export properties CSV:", error);
      toast.error("تعذر تصدير الملف");
    }
  };

  return (
    <>
      <ListPage
        embedded={embedded}
        dir="rtl"
        visualVariant="malek-pro"
        title="العقارات"
        description="متابعة جاهزية العقار والمالك واتفاقية التشغيل والوحدات من مساحة واحدة."
        count={controller.totalCount}
        primaryAction={
          <Button onClick={controller.openCreateModal}>
            <Plus className="me-2 size-4" />
            إضافة عقار
          </Button>
        }
        secondaryActions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleExportCsv}
              disabled={controller.properties.length === 0}
              aria-label="تصدير العقارات كملف CSV"
            >
              <Download className="me-2 size-4" />
              تصدير CSV
            </Button>
          </div>
        }
        search={{
          value: controller.search,
          onChange: (value) => {
            controller.setSearch(value);
            controller.setPage(1);
          },
          placeholder: "بحث بالاسم أو العنوان...",
        }}
        filters={
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Select
              aria-label="الحالة"
              value={controller.status}
              onChange={(event) => {
                controller.setStatus(event.target.value as typeof controller.status);
                controller.setPage(1);
              }}
              className="h-10 w-36 shrink-0 rounded-lg"
            >
              <option value="all">كل الحالات</option>
              {controller.statusValues.map((status) => (
                <option key={status} value={status}>
                  {controller.statusLabels[status]}
                </option>
              ))}
            </Select>
            <ActiveFilterBar
              filters={controller.activeFilters}
              onClearAll={controller.clearFilters}
            />
          </div>
        }
        toolbarActions={
          <DataTableColumnsMenu
            columns={propertyColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
        }
      >
        {!controller.propertiesQuery.isLoading && !controller.propertiesQuery.isError ? (
          <section
            data-property-summary
            aria-label="ملخص جاهزية العقارات"
            className="grid gap-3 lg:grid-cols-[minmax(17rem,1.05fr)_minmax(0,2fr)]"
          >
            <OperationalCommandPanel
              label="جاهزية التشغيل"
              value={`${formatCount(readinessRate)}%`}
              icon={CircleCheck}
              progress={readinessRate}
              footer={(
                <>
                  <span>{formatCount(readyCount)} جاهزة</span>
                  <span>{formatCount(attentionCount)} تحتاج متابعة</span>
                </>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <OperationalMetricCard
                label="إجمالي العقارات"
                value={formatCount(controller.totalCount)}
                hint="كل النتائج المطابقة"
                icon={Building2}
              />
              <OperationalMetricCard
                label="مرتبطة بمالك"
                value={formatCount(linkedOwnerCount)}
                hint="ضمن الصفحة الحالية"
                icon={Handshake}
              />
            </div>
          </section>
        ) : null}

        <section data-property-register className="min-w-0 space-y-2.5">
          <header className="flex min-h-11 items-center justify-between gap-3 px-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black">سجل العقارات</h2>
                <p className="truncate text-[11px] font-medium text-muted-foreground">
                  {formatCount(controller.properties.length)} عقار في الصفحة الحالية
                </p>
              </div>
            </div>
            {attentionCount > 0 ? (
              <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-warning/20 bg-warning-bg px-2.5 py-1.5 text-[11px] font-black text-warning">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                {formatCount(attentionCount)} تحتاج متابعة
              </span>
            ) : null}
          </header>

          <EntityTable
            aria-label="جدول العقارات"
            rows={controller.properties}
            keyOf={(property) => property.id}
            onRowClick={(property) => controller.navigateToProperty(property.id)}
            mobileVisibleSecondaryKey="status"
            visibleColumnKeys={visibleColumnKeys}
            isLoading={controller.propertiesQuery.isLoading}
            error={controller.propertiesQuery.isError ? controller.propertiesQuery.error : null}
            errorTitle="تعذر تحميل قائمة العقارات"
            onRetry={() => controller.propertiesQuery.refetch()}
            emptyTitle={controller.hasFilterValues ? "لا توجد نتائج مطابقة للبحث" : "لم تُضف عقارات بعد"}
            emptyDescription={controller.hasFilterValues ? "جرّب تغيير عوامل البحث أو إزالة الفلتر." : "ابدأ بإضافة أول عقار لك."}
            emptyAction={!controller.hasFilterValues ? (
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
            columns={[
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
                key: "workflow",
                header: "المالك والتشغيل",
                priority: "secondary",
                render: (property) => <PropertyWorkflowStatus property={property} />,
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
                key: "actions",
                header: "إجراءات",
                priority: "actions",
                render: (property) => (
                  <div
                    className="flex"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <ActionMenu
                      label="إجراءات العقار"
                      items={[
                        {
                          id: "edit",
                          label: "تعديل",
                          icon: Edit,
                          onClick: () => controller.openEditModal(property.id),
                        },
                        {
                          id: "archive",
                          label: "أرشفة",
                          icon: Trash2,
                          variant: "destructive",
                          onClick: () => controller.requestArchive(
                            property.id,
                            property.title ?? "عقار",
                          ),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        </section>
      </ListPage>

      <PropertyFormModal
        open={controller.modalOpen}
        onClose={controller.closeModal}
        propertyId={controller.editPropertyId}
      />

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
    </>
  );
}

export function PropertiesWorkspace({ embedded = true }: PropertiesListPageProps) {
  return <PropertiesListPage embedded={embedded} />;
}