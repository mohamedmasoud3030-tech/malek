import { Archive, DoorOpen, Edit, FilePlus2, Plus } from "lucide-react";
import { useMemo, useState } from 'react';
import type { UseQueryResult } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { ActionMenu } from "@/components/ui/action-menu";
import { EntityCell } from "@/components/ui/entity-cell";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import type { Unit } from "@/types/domain";
import { unitStatusLabels, unitStatusToneFor } from "./unit-schema";
import { UnitRentCell } from "./components/unit-cells";
import { UnitFormModal } from "./unit-form-modal";
import { useSoftDeleteUnit } from "./use-units";
import { useUnitContractDrafts } from "@/features/contracts/queries/useUnitContractDrafts";

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

  const columns = useMemo((): ColumnDef<Unit>[] => [
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
          <StatusBadge tone={unitStatusToneFor(unit.status)}>
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
      render: (unit) => <UnitRentCell amount={unit.rent_amount} />,
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
        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`إجراءات وحدة ${unit.unit_number}`}
            items={[
              ...(canViewContracts && unitDraftsByUnitId.has(unit.id) ? [{
                id: 'draft',
                label: 'مراجعة المسودة',
                icon: FilePlus2,
                onClick: () => void navigate({ to: "/contracts/$contractId", params: { contractId: unitDraftsByUnitId.get(unit.id)! } }),
              }] : []),
              ...(unit.status === "available" && canCreateContract && !unitDraftsByUnitId.has(unit.id) ? [{
                id: 'lease',
                label: 'تأجير',
                icon: FilePlus2,
                onClick: () => startLeasing(unit),
              }] : []),
              ...(canEditUnit ? [{
                id: 'edit',
                label: 'تعديل',
                icon: Edit,
                onClick: () => openForEdit(unit),
              }] : []),
              ...(canArchiveUnit ? [{
                id: 'archive',
                label: 'أرشفة',
                icon: Archive,
                danger: true,
                disabled: deleteMutation.isPending,
                onClick: () => setArchiveCandidate(unit),
              }] : []),
            ]}
          />
        </div>
      ),
    },
  ], [canArchiveUnit, canCreateContract, canEditUnit, canViewContracts, deleteMutation.isPending, navigate, openForEdit, startLeasing, unitDraftsByUnitId]);

  return (
    <section aria-labelledby="property-units-register-heading">
      <header className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="property-units-register-heading" className="text-base font-black">الوحدات</h2>
          <p className="mt-1 text-sm text-muted-foreground">إدارة وحدات العقار الحالي فقط.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          <DataTableColumnsMenu
            columns={unitColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
          {!unitsQuery.isError && canCreateUnit ? (
            <Button className="min-h-11" onClick={openForCreate}>
              <Plus className="me-2 size-4" />
              إضافة وحدة
            </Button>
          ) : null}
        </div>
      </header>

      <div className="pt-3">
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
          emptyDescription="لا توجد وحدات تابعة لهذا العقار حتى الآن — ستظهر الوحدات هنا بعد إضافتها."
          emptyAction={canCreateUnit ? <Button onClick={openForCreate}>إضافة وحدة</Button> : undefined}
          onRowClick={(unit) =>
            navigate({
              to: "/properties/$propertyId/units/$unitId",
              params: { propertyId, unitId: unit.id },
            })
          }
          mobileCardType="unit"
          mobileBadgeKey="status"
          mobilePrimaryMetaKeys={["rent_amount"]}
          mobileSecondaryMetaKeys={["notes"]}
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
    </section>
  );
}
