import { Link } from "@tanstack/react-router";
import {
  Building2,
  Edit,
  Plus,
} from "lucide-react";
import { useState } from "react";
import {
  useUnitsListController,
  getUnitPageStatus,
} from "./use-units-list-controller";
import { EmbeddableWorkspace } from "@/components/layout/embeddable-workspace";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { EntitySummaryStrip } from "@/components/ui/entity-summary-strip";
import { formatMoney, formatNumber } from "@/hooks/useCompanyFormatters";
import { UnitFormModal } from "./unit-form-modal";
import type { Unit } from "@/types/domain";

const unitStatusTone = {
  available: "success",
  occupied: "info",
  maintenance: "warning",
  reserved: "neutral",
} as const;

const unitRegisterColumnOptions = [
  { key: "unit_number", label: "الوحدة", locked: true },
  { key: "property", label: "العقار" },
  { key: "floor", label: "الدور" },
  { key: "status", label: "الحالة" },
  { key: "rent", label: "الإيجار" },
  { key: "notes", label: "ملاحظات" },
  { key: "action", label: "الإجراء", locked: true },
] as const;

const defaultUnitRegisterColumns = unitRegisterColumnOptions.map((column) => column.key);


export type UnitsWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function UnitsWorkspace({ embedded = false }: UnitsWorkspaceProps) {
  const ctrl = useUnitsListController();
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultUnitRegisterColumns]);
  if (ctrl.isLoading) return <LoadingState variant="route" />;

  const totalUnits = ctrl.units.length;
  const occupancyRate = totalUnits > 0
    ? Math.round((ctrl.kpis.occupiedCount / totalUnits) * 100)
    : 0;
  const maintenanceCount = ctrl.units.filter(
    (unit) => getUnitPageStatus(unit) === "maintenance",
  ).length;

  const primaryAction = (
    <Button onClick={ctrl.openCreate}>
      <Plus className="me-2 size-4" />
      إضافة وحدة
    </Button>
  );
  const secondaryActions = !embedded ? (
    <Button asChild variant="secondary" className="min-h-11">
      <Link to="/properties">
        <Building2 className="me-2 size-4" />
        العقارات
      </Link>
    </Button>
  ) : undefined;

  const columns: ColumnDef<Unit>[] = [
    {
      key: "unit_number",
      header: "الوحدة",
      priority: "identity",
      render: (unit) => <span className="font-bold">{unit.unit_number}</span>,
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
          <Button variant="secondary" onClick={() => ctrl.openEdit(unit)}>
            <Edit className="me-1 size-4" aria-hidden="true" />
            تعديل
          </Button>
          <Button variant="ghost" asChild>
            <Link
              to="/properties/$propertyId/units/$unitId"
              params={{ propertyId: unit.property_id, unitId: unit.id }}
            >
              التفاصيل
            </Link>
          </Button>
        </div>
      ),
    },
  ];

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
      secondaryActions={secondaryActions}
    >
      <FilterBar
        searchValue={ctrl.search}
        onSearchChange={ctrl.setSearch}
        searchPlaceholder="رقم الوحدة، الدور، العقار"
        searchAriaLabel="بحث في الوحدات"
        mobileFilterCount={Number(ctrl.propertyId !== "all") + Number(ctrl.status !== "all") + Number(ctrl.occupancy !== "all")}
        mobileFilterTitle="تصفية الوحدات"
        filters={
          <>
            <label className="grid min-w-0 gap-1 md:w-44">
              <span className="text-xs font-bold text-muted-foreground md:sr-only">العقار</span>
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

            <div className="grid min-w-0 gap-1">
              <span className="text-xs font-bold text-muted-foreground md:sr-only">الحالة</span>
              <FilterTabs
                options={[
                  { value: "all", label: "الكل" },
                  ...ctrl.statusValues.map((value) => ({ value, label: ctrl.statusLabels[value] })),
                ]}
                value={ctrl.status}
                onChange={(value) => ctrl.setStatus(value as typeof ctrl.status)}
                ariaLabel="حالة الوحدة"
              />
            </div>

            <label className="grid min-w-0 gap-1 md:w-36">
              <span className="text-xs font-bold text-muted-foreground md:sr-only">الإشغال</span>
              <Select
                aria-label="الإشغال"
                value={ctrl.occupancy}
                onChange={(event) => ctrl.setOccupancy(event.target.value as typeof ctrl.occupancy)}
              >
                <option value="all">كل الإشغال</option>
                <option value="occupied">مشغولة فقط</option>
                <option value="open">غير مشغولة</option>
              </Select>
            </label>
          </>
        }
        actions={(
          <DataTableColumnsMenu
            columns={unitRegisterColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
        )}
      />

      <div data-unit-summary>
        <EntitySummaryStrip
          ariaLabel="ملخص سجل الوحدات"
          items={[
            { label: "الوحدات", value: formatNumber(totalUnits) },
            { label: "الإشغال", value: `${formatNumber(occupancyRate)}%` },
            { label: "متاحة", value: formatNumber(ctrl.kpis.availableCount), tone: "success" },
            { label: "صيانة", value: formatNumber(maintenanceCount), tone: "warning", hidden: maintenanceCount === 0 },
            { label: "الإيجار المتوقع", value: formatMoney(ctrl.kpis.expectedRent) },
          ]}
        />
      </div>

      <section data-unit-register className="min-w-0">
        <EntityTable
          aria-label="جدول الوحدات"
          rows={ctrl.filteredUnits}
          columns={columns}
          visibleColumnKeys={visibleColumnKeys}
          onRowClick={ctrl.navigateToUnit}
          mobileVisibleSecondaryKeys={["property", "status", "rent"]}
          keyOf={(unit) => unit.id}
          isLoading={ctrl.unitsQuery.isLoading || ctrl.propertiesQuery.isLoading}
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
