import { Archive, DoorOpen, Edit, Plus } from "lucide-react";
import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EntityCell } from "@/components/ui/entity-cell";
import { EntityTable } from "@/components/ui/entity-table";
import { MobileCard } from "@/components/ui/mobile-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/hooks/useCompanyFormatters";
import type { Unit } from "@/types/domain";
import { unitStatusLabels } from "./unit-schema";
import { UnitFormModal } from "./unit-form-modal";
import { useSoftDeleteUnit } from "./use-units";

const unitStatusTone = {
  available: "green",
  occupied: "blue",
  maintenance: "gold",
  reserved: "gray",
} as const;

export function UnitsList({
  propertyId,
  unitsQuery,
}: Readonly<{ propertyId: string; unitsQuery: UseQueryResult<Unit[]> }>) {
  const deleteMutation = useSoftDeleteUnit(propertyId);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<Unit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  const openForCreate = () => {
    setEditingUnit(null);
    setModalOpen(true);
  };
  const openForEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setModalOpen(true);
  };
  const confirmArchive = async () => {
    if (!archiveCandidate || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(archiveCandidate.id);
      setArchiveCandidate(null);
    } catch {
      // keep dialog open on failure
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>الوحدات</CardTitle>
          <CardDescription>إدارة وحدات العقار الحالي فقط.</CardDescription>
        </div>
        {!unitsQuery.isError ? (
          <Button onClick={openForCreate}>
            <Plus className="me-2 size-4" />
            إضافة وحدة
          </Button>
        ) : null}
      </CardHeader>

      <div className="px-3 pb-4 sm:px-6 sm:pb-6">
        <EntityTable
          aria-label="جدول وحدات العقار"
          rows={unitsQuery.data ?? []}
          columns={[
            {
              key: "unit_number",
              header: "رقم الوحدة",
              render: (unit) => (
                <EntityCell
                  icon={DoorOpen}
                  title={`وحدة ${unit.unit_number}`}
                  subtitle={unit.floor ? `الدور: ${unit.floor}` : null}
                />
              ),
            },
            {
              key: "status",
              header: "الحالة",
              render: (unit) => (
                <StatusBadge tone={unitStatusTone[unit.status]}>
                  {unitStatusLabels[unit.status]}
                </StatusBadge>
              ),
            },
            {
              key: "rent_amount",
              header: "الإيجار",
              render: (unit) => (
                <span dir="ltr" className="block font-bold">
                  {formatMoney(unit.rent_amount)}
                </span>
              ),
            },
            {
              key: "notes",
              header: "ملاحظات",
              render: (unit) => unit.notes ?? "—",
            },
            {
              key: "actions",
              header: "إجراءات",
              render: (unit) => (
                <div
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="secondary"
                    className="min-h-11 px-3"
                    aria-label={`تعديل وحدة ${unit.unit_number}`}
                    onClick={() => openForEdit(unit)}
                  >
                    <Edit className="size-4" />
                  </Button>
                  <Button
                    variant="danger"
                    className="min-h-11 px-3"
                    aria-label={`أرشفة وحدة ${unit.unit_number}`}
                    onClick={() => setArchiveCandidate(unit)}
                    disabled={deleteMutation.isPending}
                  >
                    <Archive className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
          keyOf={(u) => u.id}
          isLoading={unitsQuery.isLoading}
          error={unitsQuery.isError ? unitsQuery.error : null}
          errorTitle="تعذر تحميل وحدات العقار"
          onRetry={() => unitsQuery.refetch()}
          emptyTitle="لا توجد وحدات"
          emptyDescription="أضف الوحدات التابعة لهذا العقار من هنا."
          emptyAction={<Button onClick={openForCreate}>إضافة وحدة</Button>}
          onRowClick={(unit) =>
            navigate({
              to: "/properties/$propertyId/units/$unitId",
              params: { propertyId, unitId: unit.id },
            })
          }
          enableViewModeToggle
          viewModeStorageKey="rentrix:view-mode:property-units"
          renderMobileCard={(unit) => (
            <MobileCard
              title={`وحدة ${unit.unit_number}`}
              subtitle={unit.floor ? `الدور ${unit.floor}` : "الدور غير محدد"}
              badge={
                <StatusBadge tone={unitStatusTone[unit.status]}>
                  {unitStatusLabels[unit.status]}
                </StatusBadge>
              }
              stats={
                <div className="flex items-center gap-4 text-sm font-bold">
                  {unit.rent_amount != null ? (
                    <span dir="ltr">{formatMoney(unit.rent_amount)}</span>
                  ) : null}
                  {unit.notes ? (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {unit.notes}
                    </span>
                  ) : null}
                </div>
              }
              onClick={() =>
                navigate({
                  to: "/properties/$propertyId/units/$unitId",
                  params: { propertyId, unitId: unit.id },
                })
              }
              actions={
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button
                    className="min-h-11"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openForEdit(unit);
                    }}
                  >
                    <Edit className="me-2 size-4" />
                    تعديل
                  </Button>
                  <Button
                    className="min-h-11"
                    variant="danger"
                    disabled={deleteMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      setArchiveCandidate(unit);
                    }}
                  >
                    <Archive className="me-2 size-4" />
                    أرشفة
                  </Button>
                </div>
              }
            />
          )}
        />
      </div>

      <UnitFormModal
        propertyId={propertyId}
        unit={editingUnit}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
      <ConfirmDialog
        open={Boolean(archiveCandidate)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setArchiveCandidate(null);
        }}
        title={`أرشفة الوحدة ${archiveCandidate?.unit_number ?? ""}؟`}
        description={`سيتم أرشفة الوحدة "${archiveCandidate?.unit_number ?? ''}" — العقار: ${archiveCandidate?.property_id ? archiveCandidate.property_id.slice(0, 8) : ''} — ستبقى البيانات محفوظة كسجل أرشيفي ولن تظهر ضمن الوحدات النشطة.`}
        confirmLabel="تأكيد الأرشفة"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmArchive}
      />
    </Card>
  );
}
