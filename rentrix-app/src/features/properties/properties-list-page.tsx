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
import { PropertyFormModal } from "./property-form-modal";
import { usePropertyListController } from "./use-property-list-controller";
import { AsyncContentState } from "@/components/async-content-state";
import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EntityCell } from "@/components/ui/entity-cell";
import { OperationalCommandPanel, OperationalMetricCard } from "@/components/ui/operational-summary";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActiveFilterBar } from "@/components/ui/active-filter-bar";
import { DataTable } from "@/components/ui/data-table";
import { MobileCard } from "@/components/ui/mobile-card";
import { ActionMenu } from "@/components/ui/action-menu";
import { EntityCard } from "@/components/ui/entity-card";
import { ResponsiveCardGrid } from "@/components/ui/responsive-card-grid";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { useViewModePreference } from "@/hooks/use-view-mode-preference";
import { getAppLanguageState, translateSharedLabel } from "@/lib/i18n";
import { toast } from "sonner";
import {
  buildPropertiesCsvBlob,
  buildPropertiesCsvFilename,
} from "./property-list-export";
import { propertyStatusTone } from "./components/property-status";
import type { PropertyListItem } from "./property-service";

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
  const [viewMode, setViewMode] = useViewModePreference(
    "rentrix:view-mode:properties",
  );

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
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
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
          <div className="space-y-2">
            <Select
              aria-label="الحالة"
              value={controller.status}
              onChange={(event) => {
                controller.setStatus(event.target.value as typeof controller.status);
                controller.setPage(1);
              }}
              className="w-full rounded-xl sm:w-36"
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

            <div className="grid gap-3 sm:grid-cols-3">
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
              <OperationalMetricCard
                label="تحتاج متابعة"
                value={formatCount(attentionCount)}
                hint="مالك أو اتفاقية تشغيل"
                icon={TriangleAlert}
              />
            </div>
          </section>
        ) : null}

        <section
          data-property-register
          className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
        >
          <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                  <Building2 className="size-4.5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-black">سجل العقارات</h2>
              </div>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                {formatCount(controller.properties.length)} عقار في الصفحة الحالية.
              </p>
            </div>
            {attentionCount > 0 ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-warning/20 bg-warning-bg px-3 py-1.5 text-xs font-black text-warning">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                {formatCount(attentionCount)} تحتاج متابعة
              </span>
            ) : null}
          </header>

          <div className="p-3 sm:p-4">
            <AsyncContentState
              status={
                controller.propertiesQuery.isLoading
                  ? "loading"
                  : controller.propertiesQuery.isError
                    ? "error"
                    : controller.properties.length === 0
                      ? "empty"
                      : "ready"
              }
              error={controller.propertiesQuery.error}
              errorTitle="تعذر تحميل قائمة العقارات"
              errorAction={
                <Button onClick={() => controller.propertiesQuery.refetch()}>
                  إعادة المحاولة
                </Button>
              }
              emptyTitle={
                controller.hasFilterValues
                  ? "لا توجد نتائج مطابقة للبحث"
                  : "لم تُضف عقارات بعد"
              }
              emptyDescription={
                controller.hasFilterValues
                  ? "جرّب تغيير عوامل البحث أو إزالة الفلتر."
                  : "ابدأ بإضافة أول عقار لك."
              }
              emptyAction={
                !controller.hasFilterValues ? (
                  <Button onClick={controller.openCreateModal}>
                    <Building2 className="me-2 size-4" />
                    إضافة أول عقار
                  </Button>
                ) : undefined
              }
            >
              {viewMode === "list" ? (
                <DataTable
                  aria-label="جدول العقارات"
                  enableViewModeToggle={false}
                  rows={controller.properties}
                  keyOf={(property) => property.id}
                  onRowClick={(property) => controller.navigateToProperty(property.id)}
                  columns={[
                    {
                      key: "title",
                      header: "العقار",
                      render: (property) => (
                        <EntityCell icon={Building2} title={property.title ?? "—"} />
                      ),
                    },
                    {
                      key: "status",
                      header: "الحالة",
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
                      render: (property) => <PropertyWorkflowStatus property={property} />,
                    },
                    {
                      key: "address",
                      header: "العنوان",
                      render: (property) => (
                        <span className="text-sm text-muted-foreground">
                          {property.address ?? "—"}
                        </span>
                      ),
                    },
                    {
                      key: "actions",
                      header: "إجراءات",
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
                  renderMobileCard={(property) => (
                    <MobileCard
                      title={property.title ?? "عقار"}
                      subtitle={property.address ?? "العنوان غير محدد"}
                      badge={
                        <StatusBadge
                          tone={
                            propertyStatusTone[
                              property.status as keyof typeof propertyStatusTone
                            ] ?? "gray"
                          }
                          dot
                        >
                          {controller.statusLabels[
                            property.status as keyof typeof controller.statusLabels
                          ] ?? property.status}
                        </StatusBadge>
                      }
                      stats={<PropertyWorkflowStatus property={property} />}
                      onClick={() => controller.navigateToProperty(property.id)}
                      actions={
                        <div className="grid w-full grid-cols-2 gap-2">
                          <Button
                            variant="secondary"
                            className="min-h-11 gap-1 text-xs"
                            onClick={() => controller.openEditModal(property.id)}
                          >
                            <Edit className="size-3.5" />
                            تعديل
                          </Button>
                          <Button
                            variant="danger"
                            className="min-h-11 gap-1 text-xs"
                            onClick={() => controller.requestArchive(
                              property.id,
                              property.title ?? "عقار",
                            )}
                          >
                            <Trash2 className="size-3.5" />
                            أرشفة
                          </Button>
                        </div>
                      }
                    />
                  )}
                />
              ) : (
                <ResponsiveCardGrid desktopColumns={3} gap="lg">
                  {controller.properties.map((property) => (
                    <EntityCard
                      key={property.id}
                      id={property.id}
                      name={property.title ?? "عقار"}
                      subtitle={property.address ?? "العنوان غير محدد"}
                      avatarIcon={Building2}
                      badge={
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
                      }
                      meta={[
                        {
                          icon: MapPin,
                          value: property.address ?? "العنوان غير محدد",
                        },
                        {
                          icon: Handshake,
                          value: property.workflow_health === "owner_unavailable"
                            ? property.current_owner_name
                              ? `المالك المرتبط غير نشط: ${property.current_owner_name}`
                              : "سجل المالك المرتبط غير متاح"
                            : property.current_owner_name
                              ? `المالك: ${property.current_owner_name}`
                              : "لا يوجد ربط ملكية ساري",
                        },
                        {
                          icon: Building2,
                          value: property.workflow_health === "ready"
                            ? "جاهز للتشغيل"
                            : property.workflow_health === "missing_owner"
                              ? "يحتاج ربط مالك"
                              : property.workflow_health === "owner_unavailable"
                                ? "راجع حالة المالك المرتبط"
                                : "يحتاج اتفاقية تشغيل",
                        },
                      ]}
                      onClick={() => controller.navigateToProperty(property.id)}
                      actions={[
                        {
                          label: "تعديل",
                          icon: Edit,
                          onClick: () => controller.openEditModal(property.id),
                        },
                        {
                          label: "أرشفة",
                          icon: Trash2,
                          variant: "danger",
                          onClick: () => controller.requestArchive(
                            property.id,
                            property.title ?? "عقار",
                          ),
                        },
                      ]}
                    />
                  ))}
                </ResponsiveCardGrid>
              )}
            </AsyncContentState>
          </div>
        </section>

        {!controller.propertiesQuery.isLoading &&
          !controller.propertiesQuery.isError &&
          controller.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-card">
              <Button
                variant="secondary"
                className="rounded-xl"
                disabled={controller.page <= 1}
                onClick={() => controller.setPage((page) => Math.max(1, page - 1))}
              >
                السابق
              </Button>
              <span className="text-sm font-bold text-muted-foreground">
                {controller.page} / {controller.totalPages}
              </span>
              <Button
                variant="secondary"
                className="rounded-xl"
                disabled={controller.page >= controller.totalPages}
                onClick={() => controller.setPage((page) => Math.min(controller.totalPages, page + 1))}
              >
                التالي
              </Button>
            </div>
          )}
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
        isLoading={controller.isArchiving}
        onConfirm={controller.confirmArchive}
      />
    </>
  );
}

export function PropertiesWorkspace({ embedded = true }: PropertiesListPageProps) {
  return <PropertiesListPage embedded={embedded} />;
}
