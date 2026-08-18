import { Link } from "@tanstack/react-router";
import {
  Building2,
  CircleGauge,
  DoorOpen,
  Edit,
  Home,
  Plus,
  Wrench,
} from "lucide-react";
import {
  useUnitsListController,
  getUnitPageStatus,
} from "./use-units-list-controller";
import { EmbeddableWorkspace } from "@/components/layout/embeddable-workspace";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityTable } from "@/components/ui/entity-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatMoney, formatNumber } from "@/hooks/useCompanyFormatters";
import { UnitFormModal } from "./unit-form-modal";

const unitStatusTone = {
  available: "success",
  occupied: "info",
  maintenance: "warning",
  reserved: "neutral",
} as const;

function UnitSummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: Readonly<{
  icon: typeof DoorOpen;
  label: string;
  value: string;
  hint: string;
}>) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-card">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-black tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export type UnitsWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function UnitsWorkspace({ embedded = false }: UnitsWorkspaceProps) {
  const ctrl = useUnitsListController();
  if (ctrl.isLoading) return <LoadingState variant="route" />;

  const totalUnits = ctrl.units.length;
  const occupancyRate = totalUnits > 0
    ? Math.round((ctrl.kpis.occupiedCount / totalUnits) * 100)
    : 0;
  const maintenanceCount = ctrl.units.filter(
    (unit) => getUnitPageStatus(unit) === "maintenance",
  ).length;

  const primaryAction = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button onClick={ctrl.openCreate}>
        <Plus className="me-2 size-4" />
        إضافة وحدة
      </Button>
      {!embedded ? (
        <Button asChild variant="secondary" className="min-h-11">
          <Link to="/properties">
            <Building2 className="me-2 size-4" />
            العقارات
          </Link>
        </Button>
      ) : null}
    </div>
  );

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      dir="rtl"
      size="wide"
      visualVariant="malek-pro"
      title="الوحدات"
      description="متابعة الإشغال والتأجير والصيانة لكل وحدة من مساحة تشغيل واحدة."
      count={formatNumber(totalUnits)}
      primaryAction={primaryAction}
    >
      <section
        data-unit-summary
        aria-label="ملخص تشغيل الوحدات"
        className="grid gap-3 lg:grid-cols-[minmax(17rem,1.1fr)_minmax(0,2fr)]"
      >
        <article className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-elevated">
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-sidebar-foreground/65">معدل الإشغال الحالي</p>
                <p className="mt-2 text-4xl font-black tabular-nums">{formatNumber(occupancyRate)}%</p>
              </div>
              <span className="grid size-12 place-items-center rounded-2xl border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
                <CircleGauge className="size-6" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-sidebar-accent">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${Math.min(100, Math.max(0, occupancyRate))}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-sidebar-foreground/72">
              <span>{formatNumber(ctrl.kpis.occupiedCount)} مشغولة</span>
              <span>{formatNumber(ctrl.kpis.availableCount)} متاحة</span>
              <span>{formatNumber(maintenanceCount)} صيانة</span>
            </div>
          </div>
        </article>

        <div className="grid gap-3 sm:grid-cols-3">
          <UnitSummaryCard
            label="إجمالي الوحدات"
            value={formatNumber(totalUnits)}
            hint="كل الوحدات النشطة"
            icon={DoorOpen}
          />
          <UnitSummaryCard
            label="الوحدات المتاحة"
            value={formatNumber(ctrl.kpis.availableCount)}
            hint="جاهزة للتأجير"
            icon={Home}
          />
          <UnitSummaryCard
            label="الإيجار المتوقع"
            value={formatMoney(ctrl.kpis.expectedRent)}
            hint="من قيم الإيجار المسجلة"
            icon={Building2}
          />
        </div>
      </section>

      <FilterBar
        searchValue={ctrl.search}
        onSearchChange={ctrl.setSearch}
        searchPlaceholder="رقم الوحدة، الدور، العقار"
        searchAriaLabel="بحث في الوحدات"
        filters={
          <>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-36">
              <span className="sr-only">العقار</span>
              <Select
                aria-label="العقار"
                value={ctrl.propertyId}
                onChange={(event) => ctrl.setPropertyId(event.target.value)}
              >
                <option value="all">كل العقارات</option>
                {ctrl.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title}
                  </option>
                ))}
              </Select>
            </label>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32">
              <span className="sr-only">الحالة</span>
              <Select
                aria-label="الحالة"
                value={ctrl.status}
                onChange={(event) =>
                  ctrl.setStatus(
                    event.target.value as "all" | typeof ctrl.status,
                  )
                }
              >
                <option value="all">كل الحالات</option>
                {ctrl.statusValues.map((value) => (
                  <option key={value} value={value}>
                    {ctrl.statusLabels[value]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32">
              <span className="sr-only">الإشغال</span>
              <Select
                aria-label="الإشغال"
                value={ctrl.occupancy}
                onChange={(event) =>
                  ctrl.setOccupancy(event.target.value as typeof ctrl.occupancy)
                }
              >
                <option value="all">كل الوحدات</option>
                <option value="occupied">مشغولة فقط</option>
                <option value="open">غير مشغولة</option>
              </Select>
            </label>
          </>
        }
      />

      <section
        data-unit-register
        className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
      >
        <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                <DoorOpen className="size-4.5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-black">سجل الوحدات</h2>
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">
              {formatNumber(ctrl.filteredUnits.length)} وحدة ضمن الفلاتر الحالية.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success-bg px-2.5 py-1 text-success">
              <Home className="size-3.5" aria-hidden="true" />
              {formatNumber(ctrl.kpis.availableCount)} متاحة
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning-bg px-2.5 py-1 text-warning">
              <Wrench className="size-3.5" aria-hidden="true" />
              {formatNumber(maintenanceCount)} صيانة
            </span>
          </div>
        </header>

        <div className="p-3 sm:p-4">
          {
            <EntityTable
              aria-label="جدول الوحدات"
              rows={ctrl.filteredUnits}
              columns={[
                {
                  key: "unit_number",
                  header: "الوحدة",
                  priority: "identity",
                  render: (unit) => (
                    <span className="font-bold">{unit.unit_number}</span>
                  ),
                },
                {
                  key: "property",
                  header: "العقار",
                  priority: "secondary",
                  render: (unit) => {
                    const property = ctrl.propertyById.get(unit.property_id);
                    return property ? (
                      <Link
                        className="font-bold text-primary hover:underline"
                        to="/properties/$propertyId"
                        params={{ propertyId: property.id }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {property.title}
                      </Link>
                    ) : (
                      "—"
                    );
                  },
                },
                {
                  key: "floor",
                  header: "الدور",
                  priority: "detail",
                  render: (unit) => unit.floor ?? "—",
                },
                {
                  key: "status",
                  header: "الحالة",
                  priority: "primary",
                  render: (unit) => {
                    const unitStatus = getUnitPageStatus(unit);
                    return (
                      <StatusBadge tone={unitStatusTone[unitStatus]}>
                        {ctrl.statusLabels[unitStatus]}
                      </StatusBadge>
                    );
                  },
                },
                {
                  key: "rent",
                  header: "الإيجار",
                  priority: "secondary",
                  render: (unit) => (
                    <span dir="ltr" className="block font-bold tabular-nums">
                      {formatMoney(unit.rent_amount)}
                    </span>
                  ),
                },
                {
                  key: "notes",
                  header: "ملاحظات",
                  priority: "detail",
                  render: (unit) => unit.notes ?? "—",
                },
                {
                  key: "action",
                  header: "إجراء",
                  priority: "actions",
                  render: (unit) => (
                    <div
                      className="flex gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        variant="secondary"
                        onClick={() => ctrl.openEdit(unit)}
                      >
                        <Edit className="me-1 size-4" aria-hidden="true" />
                        تعديل
                      </Button>
                      <Button variant="ghost" asChild>
                        <Link
                          to="/properties/$propertyId/units/$unitId"
                          params={{
                            propertyId: unit.property_id,
                            unitId: unit.id,
                          }}
                        >
                          التفاصيل
                        </Link>
                      </Button>
                    </div>
                  ),
                },
              ]}
              onRowClick={ctrl.navigateToUnit}
              mobileVisibleSecondaryKey="status"

              keyOf={(unit) => unit.id}
              isLoading={
                ctrl.unitsQuery.isLoading || ctrl.propertiesQuery.isLoading
              }
              error={ctrl.isError ? new Error("تعذر تحميل الوحدات") : null}
              errorTitle="تعذر تحميل الوحدات"
              onRetry={ctrl.refetchAll}
              emptyTitle="لا توجد وحدات مطابقة"
              emptyDescription="غيّر البحث أو الفلاتر لعرض وحدات أخرى، أو أضف وحدة مرتبطة بعقار قائم."
              emptyAction={
                <Button onClick={ctrl.openCreate}>
                  <Plus className="me-2 size-4" />
                  إضافة وحدة
                </Button>
              }
            />
          }
        </div>
      </section>

      <UnitFormModal
        propertyId=""
        unit={null}
        open={ctrl.isCreateOpen}
        onOpenChange={(open) => {
          if (!open) ctrl.closeCreate();
        }}
      />

      <UnitFormModal
        propertyId={ctrl.editingUnit?.property_id ?? ""}
        unit={ctrl.editingUnit}
        open={ctrl.editingUnit !== null}
        onOpenChange={(open) => {
          if (!open) ctrl.closeEdit();
        }}
      />
    </EmbeddableWorkspace>
  );
}

export function UnitsPage() {
  return <UnitsWorkspace />;
}
