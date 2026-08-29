import { Link } from "@tanstack/react-router";
import {
  Building2,
  CircleGauge,
  DoorOpen,
  Edit,
  Eye,
  Home,
  Plus,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import {
  useUnitsListController,
  getUnitPageStatus,
} from "./use-units-list-controller";
import { EmbeddableWorkspace } from "@/components/layout/embeddable-workspace";
import { RegisterHeading, RegisterMetricStrip } from "@/components/layout/register-summary";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatMoney, formatNumber } from "@/hooks/useCompanyFormatters";
import { useAuth } from "@/hooks/use-auth";
import { UnitFormModal } from "./unit-form-modal";
import { UnitPreviewDialog } from "./components/UnitPreviewDialog";
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
  const { canAccess } = useAuth();
  const canCreateUnit = canAccess("properties.create");
  const canEditUnit = canAccess("properties.edit");
  const [previewUnitId, setPreviewUnitId] = useState<string | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultUnitRegisterColumns]);
  if (ctrl.isLoading) return <LoadingState variant="route" />;

  const totalUnits = ctrl.units.length;
  const occupancyRate = totalUnits > 0
    ? Math.round((ctrl.kpis.occupiedCount / totalUnits) * 100)
    : 0;
  const maintenanceCount = ctrl.units.filter(
    (unit) => getUnitPageStatus(unit) === "maintenance",
  ).length;
  const openPreview = (unit: Unit) => setPreviewUnitId(unit.id);

  const primaryAction = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {canCreateUnit ? (
        <Button onClick={ctrl.openCreate}>
          <Plus className="me-2 size-4" />
          إضافة وحدة
        </Button>
      ) : null}
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
          className="flex flex-wrap gap-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {canEditUnit ? (
            <Button variant="secondary" onClick={() => ctrl.openEdit(unit)}>
              <Edit className="me-1 size-4" aria-hidden="true" />
              تعديل
            </Button>
          ) : null}
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
      count={formatNumber(totalUnits)}
      primaryAction={primaryAction}
    >
      <section data-unit-summary aria-label="ملخص تشغيل الوحدات">
        <RegisterMetricStrip
          aria-label="ملخص تشغيل الوحدات"
          items={[
            { id: 'total', label: 'الوحدات', value: formatNumber(totalUnits), icon: DoorOpen },
            { id: 'occupancy', label: 'الإشغال', value: `${formatNumber(occupancyRate)}%`, hint: `${formatNumber(ctrl.kpis.occupiedCount)} مشغولة`, icon: CircleGauge },
            { id: 'available', label: 'متاحة', value: formatNumber(ctrl.kpis.availableCount), icon: Home, tone: 'success', hideWhenEmpty: true },
            { id: 'maintenance', label: 'صيانة', value: formatNumber(maintenanceCount), icon: Wrench, tone: 'warning', hideWhenEmpty: true },
            { id: 'rent', label: 'الإيجار المتوقع', value: formatMoney(ctrl.kpis.expectedRent), icon: Building2 },
          ]}
        />
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
                onChange={(event) => ctrl.setStatus(event.target.value as "all" | typeof ctrl.status)}
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
                onChange={(event) => ctrl.setOccupancy(event.target.value as typeof ctrl.occupancy)}
              >
                <option value="all">كل الوحدات</option>
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

      <section data-unit-register className="min-w-0 space-y-2.5">
        <RegisterHeading
          title="سجل الوحدات"
          meta={`${formatNumber(ctrl.filteredUnits.length)} وحدة ضمن الفلاتر الحالية`}
        />

        <EntityTable
          aria-label="جدول الوحدات"
          rows={ctrl.filteredUnits}
          columns={columns}
          visibleColumnKeys={visibleColumnKeys}
          onRowClick={openPreview}
          keyOf={(unit) => unit.id}
          isLoading={ctrl.unitsQuery.isLoading || ctrl.propertiesQuery.isLoading}
          error={ctrl.isError ? new Error("تعذر تحميل الوحدات") : null}
          errorTitle="تعذر تحميل الوحدات"
          onRetry={ctrl.refetchAll}
          emptyTitle="لا توجد وحدات مطابقة"
          emptyDescription={canCreateUnit ? "غيّر البحث أو الفلاتر لعرض وحدات أخرى، أو أضف وحدة مرتبطة بعقار قائم." : "غيّر البحث أو الفلاتر لعرض وحدات أخرى."}
          emptyAction={canCreateUnit ? (
            <Button onClick={ctrl.openCreate}>
              <Plus className="me-2 size-4" />
              إضافة وحدة
            </Button>
          ) : undefined}
          mobileCardType="unit"
          mobileBadgeKey="status"
          mobileSummaryKeys={["rent", "property"]}
          mobileCardActions={(unit) => [
            {
              label: "معاينة",
              icon: Eye,
              variant: "secondary" as const,
              ariaLabel: `معاينة وحدة ${unit.unit_number}`,
              onClick: () => openPreview(unit),
            },
            ...(canEditUnit ? [{
              label: "تعديل",
              icon: Edit,
              variant: "secondary" as const,
              ariaLabel: `تعديل وحدة ${unit.unit_number}`,
              onClick: () => ctrl.openEdit(unit),
            }] : []),
            {
              label: "التفاصيل الكاملة",
              icon: DoorOpen,
              variant: "secondary" as const,
              ariaLabel: `فتح تفاصيل وحدة ${unit.unit_number}`,
              onClick: () => ctrl.navigateToUnit(unit),
            },
          ]}
        />
      </section>

      <UnitPreviewDialog
        unitId={previewUnitId}
        open={Boolean(previewUnitId)}
        onOpenChange={(open) => { if (!open) setPreviewUnitId(null); }}
      />

      {canCreateUnit ? (
        <UnitFormModal
          propertyId=""
          unit={null}
          open={ctrl.isCreateOpen}
          onOpenChange={(open) => {
            if (!open) ctrl.closeCreate();
          }}
        />
      ) : null}

      {canEditUnit ? (
        <UnitFormModal
          propertyId={ctrl.editingUnit?.property_id ?? ""}
          unit={ctrl.editingUnit}
          open={ctrl.editingUnit !== null}
          onOpenChange={(open) => {
            if (!open) ctrl.closeEdit();
          }}
        />
      ) : null}
    </EmbeddableWorkspace>
  );
}

export function UnitsPage() {
  return <UnitsWorkspace />;
}
