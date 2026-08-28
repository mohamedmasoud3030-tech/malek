import { Archive, DoorOpen, Edit, FilePlus2, Plus } from "lucide-react";
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
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { EntityCell } from "@/components/ui/entity-cell";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/hooks/useCompanyFormatters";
import { useAuth } from "@/hooks/use-auth";
import type { Unit } from "@/types/domain";
import { unitStatusLabels } from "./unit-schema";
import { UnitFormModal } from "./unit-form-modal";
import { useSoftDeleteUnit } from "./use-units";
import { useUnitContractDrafts } from "@/features/contracts/queries/useUnitContractDrafts";

const unitStatusTone = {
  available: "success",
  occupied: "info",
  maintenance: "warning",
  reserved: "neutral",
} as const;

const unitColumnOptions = [
  { key: "unit_number", label: "رقم الوحدة", locked: true },
  { key: "status", label: "الحالة" },
  { key: "rent_amount", label: "الإيجار" },
  { key: "notes", label: "ملاحظات" },
  { key: "actions", label: "الإجراءات", locked: true },
] as const;

const defaultUnitColumns = unitColumnOptions.map((column) => column.key);

export function UnitsList({
  propertyId,
  unitsQuery,
}: Readonly<{ propertyId: string; unitsQuery: UseQueryResult<Unit[]> }>) {
  const { canAccess } = useAuth();
  const canCreateUnit = canAccess("properties.create");
  const canEditUnit = canAccess("properties.edit");
  const canArchiveUnit = canAccess("properties.archive");
  const canViewContracts = canAccess("contracts.view");
  const canCreateContract = canAccess("contracts.create");
  const deleteMutation = useSoftDeleteUnit(propertyId);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<Unit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultUnitColumns]);
  const navigate = useNavigate();
  const unitDraftsQuery = useUnitContractDrafts({
    propertyId,
    unitIds: canViewContracts ? unitsQuery.data?.map((unit) => unit.id) ?? [] : [],
  });
  const unitDraftsByUnitId = new Map<string, string>();
  for (const draft of unitDraftsQuery.data ?? []) {
    if (draft.unit_id && !unitDraftsByUnitId.has(draft.unit_id)) unitDraftsByUnitId.set(draft.unit_id, draft.id);
  }

  const openForCreate = () => {
    if (!canCreateUnit) return;
    setEditingUnit(null);
    setModalOpen(true);
  };
  const openForEdit = (unit: Unit) => {
    if (!canEditUnit) return;
    setEditingUnit(unit);
    setModalOpen(true);
  };
  const startLeasing = (unit: Unit) => {
    if (!canCreateContract) return;
    void navigate({
      to: "/contracts/new",
      search: { propertyId, unitId: unit.id },
    });
  };
  const confirmArchive = async () => {
    if (!canArchiveUnit || !archiveCandidate || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(archiveCandidate.id);
      setArchiveCandidate(null);
    } catch {
      // keep dialog open on failure
    }
  };

  const columns: ColumnDef<Unit>[] = [
    {
      key: "unit_number",
      header: "رقم الوحدة",
      priority: "identity",
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
      priority: "primary",
      render: (unit) => (
        <span className="flex flex-wrap gap-1.5">
          <StatusBadge tone={unitStatusTone[unit.status]}>
            {unitStatusLabels[unit.status]}
          </StatusBadge>
          {canViewContracts && unitDraftsByUnitId.has(unit.id) ? <StatusBadge tone="warning">مسودة عقد قيد الإعداد</StatusBadge> : null}
        </span>
      ),
    },
    {
      key: "rent_amount",
      header: "الإيجار",
      priority: "secondary",
      render: (unit) => (
        <span dir="ltr" className="block font-bold">
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
      key: "actions",
      header: "إجراءات",
      priority: "actions",
      render: (unit) => (
        <div
          className="flex flex-wrap gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {canViewContracts && unitDraftsByUnitId.has(unit.id) ? (
            <Button
              variant="secondary"
              className="min-h-11 px-3"
              aria-label={`مراجعة مسودة عقد وحدة ${unit.unit_number}`}
              onClick={() => void navigate({ to: "/contracts/$contractId", params: { contractId: unitDraftsByUnitId.get(unit.id)! } })}
            >
              <FilePlus2 className="me-1 size-4" aria-hidden="true" />
              مراجعة المسودة
            </Button>
          ) : unit.status === "available" && canCreateContract ? (
            <Button
              className="min-h-11 px-3"
              aria-label={`بدء تأجير وحدة ${unit.unit_number}`}
              onClick={() => startLeasing(unit)}
            >
              <FilePlus2 className="me-1 size-4" aria-hidden="true" />
              تأجير
            </Button>
          ) : null}
          {canEditUnit ? (
            <Button
              variant="secondary"
              className="min-h-11 px-3"
              aria-label={`تعديل وحدة ${unit.unit_number}`}
              onClick={() => openForEdit(unit)}
            >
              <Edit className="size-4" />
            </Button>
          ) : null}
          {canArchiveUnit ? (
            <Button
              variant="danger"
              className="min-h-11 px-3"
              aria-label={`أرشفة وحدة ${unit.unit_number}`}
              onClick={() => setArchiveCandidate(unit)}
              disabled={deleteMutation.isPending}
            >
              <Archive className="size-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>الوحدات</CardTitle>
          <CardDescription>إدارة وحدات العقار الحالي فقط.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <DataTableColumnsMenu
            columns={unitColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
          {!unitsQuery.isError && canCreateUnit ? (
            <Button onClick={openForCreate}>
              <Plus className="me-2 size-4" />
              إضافة وحدة
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <div className="px-3 pb-4 sm:px-6 sm:pb-6">
        <EntityTable
          aria-label="جدول وحدات العقار"
          rows={unitsQuery.data ?? []}
          columns={columns}
          visibleColumnKeys={visibleColumnKeys}
          keyOf={(u) => u.id}
          isLoading={unitsQuery.isLoading}
          error={unitsQuery.isError ? unitsQuery.error : null}
          errorTitle="تعذر تحميل وحدات العقار"
          onRetry={() => unitsQuery.refetch()}
          emptyTitle="لا توجد وحدات"
          emptyDescription="لا توجد وحدات تابعة لهذا العقار حتى الآن."
          emptyAction={canCreateUnit ? <Button onClick={openForCreate}>إضافة وحدة</Button> : undefined}
          onRowClick={(unit) =>
            navigate({
              to: "/properties/$propertyId/units/$unitId",
              params: { propertyId, unitId: unit.id },
            })
          }
          mobileBadgeKey="status"
          mobileSummaryKeys={["rent_amount", "notes"]}
          mobileCardActions={(unit) => {
            const actions: Array<{ label: string; icon: typeof Edit; variant: "secondary" | "danger"; ariaLabel: string; onClick: () => void }> = [];
            if (canViewContracts && unitDraftsByUnitId.has(unit.id)) {
              actions.push({
                label: "مراجعة المسودة",
                icon: FilePlus2,
                variant: "secondary",
                ariaLabel: `مراجعة مسودة عقد وحدة ${unit.unit_number}`,
                onClick: () => void navigate({ to: "/contracts/$contractId", params: { contractId: unitDraftsByUnitId.get(unit.id)! } }),
              });
            } else if (unit.status === "available" && canCreateContract) {
              actions.push({
                label: "تأجير",
                icon: FilePlus2,
                variant: "secondary",
                ariaLabel: `بدء تأجير وحدة ${unit.unit_number}`,
                onClick: () => startLeasing(unit),
              });
            }
            if (canEditUnit) {
              actions.push({
                label: "تعديل",
                icon: Edit,
                variant: "secondary",
                ariaLabel: `تعديل وحدة ${unit.unit_number}`,
                onClick: () => openForEdit(unit),
              });
            }
            if (canArchiveUnit) {
              actions.push({
                label: "أرشفة",
                icon: Archive,
                variant: "danger",
                ariaLabel: `أرشفة وحدة ${unit.unit_number}`,
                onClick: () => setArchiveCandidate(unit),
              });
            }
            return actions;
          }}
        />
      </div>

      {canCreateUnit || canEditUnit ? (
        <UnitFormModal
          propertyId={propertyId}
          unit={editingUnit}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      ) : null}
      {canArchiveUnit ? (
        <ConfirmDialog
          open={Boolean(archiveCandidate)}
          onOpenChange={(open) => {
            if (!open && !deleteMutation.isPending) setArchiveCandidate(null);
          }}
          title={`أرشفة الوحدة ${archiveCandidate?.unit_number ?? ""}؟`}
          description={`سيتم أرشفة الوحدة "${archiveCandidate?.unit_number ?? ''}" — ستبقى البيانات محفوظة كسجل أرشيفي ولن تظهر ضمن الوحدات النشطة.`}
          confirmLabel="تأكيد الأرشفة"
          isLoading={deleteMutation.isPending}
          onConfirm={confirmArchive}
        >
          <ul className="mt-3 space-y-1.5 border-t border-border/50 pt-3 text-xs leading-5 text-muted-foreground">
            <li className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />لا يمكن أرشفة وحدة مرتبطة بعقد محفوظ؛ يجب الحفاظ على الوحدة للسجل والتقارير.</li>
            <li className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />لا يمكن الأرشفة مع طلب صيانة مفتوح أو قيد التنفيذ.</li>
          </ul>
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
