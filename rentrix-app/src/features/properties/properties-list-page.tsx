import { Building2, Download, Edit, MapPin, Plus, Trash2 } from "lucide-react";
import { PropertyFormModal } from "./property-form-modal";
import { usePropertyListController } from "./use-property-list-controller";
import { AsyncContentState } from "@/components/async-content-state";
import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EntityCell } from "@/components/ui/entity-cell";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActiveFilterBar } from "@/components/ui/active-filter-bar";
import { DataTable } from "@/components/ui/data-table";
import { MobileCard } from "@/components/ui/mobile-card";
import { ActionMenu } from "@/components/ui/action-menu";
import { FilterBar } from "@/components/ui/filter-bar";
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

export function PropertiesListPage() {
  const ctrl = usePropertyListController();
  const [viewMode, setViewMode] = useViewModePreference(
    "rentrix:view-mode:properties",
  );

  const handleExportCsv = () => {
    if (ctrl.properties.length === 0) {
      toast.error(
        translateSharedLabel("noResultsHint", getAppLanguageState().language),
      );
      return;
    }
    try {
      const url = URL.createObjectURL(buildPropertiesCsvBlob(ctrl.properties));
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
        dir="rtl"
        title="العقارات"
        description="إدارة المحفظة العقارية والتشغيلية"
        count={ctrl.totalCount}
        primaryAction={
          <Button onClick={ctrl.openCreateModal}>
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
              disabled={ctrl.properties.length === 0}
              aria-label="تصدير العقارات كملف CSV"
            >
              <Download className="me-2 size-4" />
              تصدير CSV
            </Button>
          </div>
        }
        filters={
          <div className="space-y-2">
            <FilterBar
              searchValue={ctrl.search}
              onSearchChange={(value) => {
                ctrl.setSearch(value);
                ctrl.setPage(1);
              }}
              searchPlaceholder="بحث بالاسم أو العنوان..."
              searchAriaLabel="بحث في العقارات"
              filters={
                <Select
                  aria-label="الحالة"
                  value={ctrl.status}
                  onChange={(e) => {
                    ctrl.setStatus(e.target.value as typeof ctrl.status);
                    ctrl.setPage(1);
                  }}
                  className="w-full sm:w-36 rounded-xl"
                >
                  <option value="all">كل الحالات</option>
                  {ctrl.statusValues.map((s) => (
                    <option key={s} value={s}>
                      {ctrl.statusLabels[s]}
                    </option>
                  ))}
                </Select>
              }
            />
            <ActiveFilterBar
              filters={ctrl.activeFilters}
              onClearAll={ctrl.clearFilters}
            />
          </div>
        }
      >
        <AsyncContentState
          status={
            ctrl.propertiesQuery.isLoading
              ? "loading"
              : ctrl.propertiesQuery.isError
                ? "error"
                : ctrl.properties.length === 0
                  ? "empty"
                  : "ready"
          }
          error={ctrl.propertiesQuery.error}
          errorTitle="تعذر تحميل قائمة العقارات"
          errorAction={
            <Button onClick={() => ctrl.propertiesQuery.refetch()}>
              إعادة المحاولة
            </Button>
          }
          emptyTitle={
            ctrl.hasFilterValues
              ? "لا توجد نتائج مطابقة للبحث"
              : "لم تُضف عقارات بعد"
          }
          emptyDescription={
            ctrl.hasFilterValues
              ? "جرّب تغيير عوامل البحث أو إزالة الفلتر."
              : "ابدأ بإضافة أول عقار لك."
          }
          emptyAction={
            !ctrl.hasFilterValues ? (
              <Button onClick={ctrl.openCreateModal}>
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
              rows={ctrl.properties}
              keyOf={(p) => p.id}
              onRowClick={(p) => ctrl.navigateToProperty(p.id)}
              columns={[
                {
                  key: "title",
                  header: "العقار",
                  render: (p) => (
                    <EntityCell icon={Building2} title={p.title ?? "—"} />
                  ),
                },
                {
                  key: "status",
                  header: "الحالة",
                  render: (p) => (
                    <StatusBadge
                      tone={
                        propertyStatusTone[
                          p.status as keyof typeof propertyStatusTone
                        ] ?? "gray"
                      }
                    >
                      {ctrl.statusLabels[
                        p.status as keyof typeof ctrl.statusLabels
                      ] ?? p.status}
                    </StatusBadge>
                  ),
                },
                {
                  key: "address",
                  header: "العنوان",
                  render: (p) => (
                    <span className="text-muted-foreground text-sm">
                      {p.address ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "إجراءات",
                  render: (p) => (
                    <div
                      className="flex"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <ActionMenu
                        label="إجراءات العقار"
                        items={[
                          {
                            id: "edit",
                            label: "تعديل",
                            icon: Edit,
                            onClick: () => ctrl.openEditModal(p.id),
                          },
                          {
                            id: "archive",
                            label: "أرشفة",
                            icon: Trash2,
                            variant: "destructive",
                            onClick: () =>
                              ctrl.requestArchive(p.id, p.title ?? "عقار"),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
              renderMobileCard={(p) => (
                <MobileCard
                  title={p.title ?? "عقار"}
                  subtitle={p.address ?? "العنوان غير محدد"}
                  badge={
                    <StatusBadge
                      tone={
                        propertyStatusTone[
                          p.status as keyof typeof propertyStatusTone
                        ] ?? "gray"
                      }
                      dot
                    >
                      {ctrl.statusLabels[
                        p.status as keyof typeof ctrl.statusLabels
                      ] ?? p.status}
                    </StatusBadge>
                  }
                  stats={
                    <span className="text-xs text-muted-foreground">
                      اضغط لفتح تفاصيل العقار
                    </span>
                  }
                  onClick={() => ctrl.navigateToProperty(p.id)}
                  actions={
                    <div className="grid w-full grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        className="min-h-11 text-xs gap-1"
                        onClick={() => ctrl.openEditModal(p.id)}
                      >
                        <Edit className="size-3.5" />
                        تعديل
                      </Button>
                      <Button
                        variant="danger"
                        className="min-h-11 text-xs gap-1"
                        onClick={() =>
                          ctrl.requestArchive(p.id, p.title ?? "عقار")
                        }
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
              {ctrl.properties.map((property) => (
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
                      {ctrl.statusLabels[
                        property.status as keyof typeof ctrl.statusLabels
                      ] ?? property.status}
                    </StatusBadge>
                  }
                  meta={[
                    {
                      icon: MapPin,
                      value: property.address ?? "العنوان غير محدد",
                    },
                  ]}
                  onClick={() => ctrl.navigateToProperty(property.id)}
                  actions={[
                    {
                      label: "تعديل",
                      icon: Edit,
                      onClick: () => ctrl.openEditModal(property.id),
                    },
                    {
                      label: "أرشفة",
                      icon: Trash2,
                      variant: "danger",
                      onClick: () =>
                        ctrl.requestArchive(
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

        {/* Pagination */}
        {!ctrl.propertiesQuery.isLoading &&
          !ctrl.propertiesQuery.isError &&
          ctrl.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                className="rounded-xl"
                disabled={ctrl.page <= 1}
                onClick={() => ctrl.setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </Button>
              <span className="text-sm font-bold text-muted-foreground">
                {ctrl.page} / {ctrl.totalPages}
              </span>
              <Button
                variant="secondary"
                className="rounded-xl"
                disabled={ctrl.page >= ctrl.totalPages}
                onClick={() =>
                  ctrl.setPage((p) => Math.min(ctrl.totalPages, p + 1))
                }
              >
                التالي
              </Button>
            </div>
          )}
      </ListPage>
      <PropertyFormModal
        open={ctrl.modalOpen}
        onClose={ctrl.closeModal}
        propertyId={ctrl.editPropertyId}
      />
      <ConfirmDialog
        open={Boolean(ctrl.archiveTarget)}
        onOpenChange={(open) => {
          if (!open) ctrl.cancelArchive();
        }}
        title={`أرشفة العقار "${ctrl.archiveTarget?.title ?? ""}"؟`}
        description="سيتم إخفاء العقار من القوائم النشطة. يمكن التراجع عن هذا لاحقاً من سجل الأرشيف."
        confirmLabel="أرشفة"
        isLoading={ctrl.isArchiving}
        onConfirm={ctrl.confirmArchive}
      />
    </>
  );
}
