import { CheckCircle2, Edit, Eye } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { MobileCard } from "@/components/ui/mobile-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Property, Unit } from "@/types/domain";
import type { Maintenance } from "../maintenance-service";
import {
  buildMaintenanceLocationLabel,
  type MaintenanceStatusFilter,
} from "../maintenance-helpers";
import { getMaintenanceStatusActions } from "../useMaintenancePageController";

export const maintenanceStatusLabels = {
  open: "مفتوح",
  in_progress: "قيد التنفيذ",
  resolved: "تم الحل",
  closed: "مغلق",
} as const;

export const maintenanceStatusTone = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "neutral",
} as const;

export const maintenancePriorityLabels = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
} as const;

export const maintenancePriorityTone = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
} as const;

const priorityAccent = {
  low: "none",
  medium: "none",
  high: "warning",
  urgent: "danger",
} as const satisfies Record<string, "none" | "warning" | "danger">;

export type MaintenanceListProps = Readonly<{
  rows: Maintenance[];
  properties: Property[];
  allUnits: Unit[];
  actionsPending: boolean;
  onViewDetails: (row: Maintenance) => void;
  onEdit: (row: Maintenance) => void;
  onStatusAction: (
    row: Maintenance,
    status: Exclude<MaintenanceStatusFilter, "all">,
  ) => void;
}>;

function MaintenanceCard({
  row,
  properties,
  allUnits,
  actionsPending,
  onViewDetails,
  onEdit,
  onStatusAction,
}: MaintenanceListProps & { row: Maintenance }) {
  const actions = getMaintenanceStatusActions(
    (row.status ?? "") as keyof typeof maintenanceStatusLabels,
  );
  const accent =
    priorityAccent[row.priority as keyof typeof priorityAccent] ?? "none";

  return (
    <MobileCard
      title={row.title}
      subtitle={buildMaintenanceLocationLabel(row, properties, allUnits)}
      badge={
        <StatusBadge
          tone={
            maintenanceStatusTone[
              row.status as keyof typeof maintenanceStatusTone
            ] ?? "neutral"
          }
        >
          {maintenanceStatusLabels[
            row.status as keyof typeof maintenanceStatusLabels
          ] ??
            row.status ??
            "—"}
        </StatusBadge>
      }
      accent={accent}
      meta={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            الأولوية
          </span>
          <StatusBadge
            tone={
              maintenancePriorityTone[
                row.priority as keyof typeof maintenancePriorityTone
              ] ?? "neutral"
            }
          >
            {maintenancePriorityLabels[
              row.priority as keyof typeof maintenancePriorityLabels
            ] ??
              row.priority ??
              "—"}
          </StatusBadge>
        </div>
      }
      actions={
        actions.length > 0 ? (
          <div className="grid w-full grid-cols-1 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full text-xs"
              onClick={() => onViewDetails(row)}
            >
              <Eye className="me-2 size-4" aria-hidden="true" />
              التفاصيل
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full text-xs"
              onClick={() => onEdit(row)}
            >
              <Edit className="me-2 size-4" aria-hidden="true" />
              تعديل
            </Button>
            {actions.map((action) => (
              <Button
                key={`${row.id}-${action.status}`}
                type="button"
                variant="secondary"
                className="min-h-11 w-full text-xs"
                disabled={actionsPending}
                onClick={() => onStatusAction(row, action.status)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : (
          <span className="flex min-h-11 items-center gap-1 text-xs font-semibold text-muted-foreground">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            مكتمل
          </span>
        )
      }
    />
  );
}

export function MaintenanceList(props: MaintenanceListProps) {
  const {
    rows,
    properties,
    allUnits,
    actionsPending,
    onViewDetails,
    onEdit,
    onStatusAction,
  } = props;

  return (
    <div data-visual-wave="malek-pro">
      <DataTable
        aria-label="جدول طلبات الصيانة"
      enableViewModeToggle
      viewModeStorageKey="rentrix:view-mode:maintenance"
      rows={rows}
      columns={[
        {
          key: "title",
          header: "العنوان",
          render: (row) => <span className="font-medium">{row.title}</span>,
        },
        {
          key: "location",
          header: "الموقع",
          render: (row) =>
            buildMaintenanceLocationLabel(row, properties, allUnits),
        },
        {
          key: "status",
          header: "الحالة",
          render: (row) => (
            <StatusBadge
              tone={
                maintenanceStatusTone[
                  row.status as keyof typeof maintenanceStatusTone
                ] ?? "neutral"
              }
            >
              {maintenanceStatusLabels[
                row.status as keyof typeof maintenanceStatusLabels
              ] ??
                row.status ??
                "—"}
            </StatusBadge>
          ),
        },
        {
          key: "priority",
          header: "الأولوية",
          render: (row) => (
            <StatusBadge
              tone={
                maintenancePriorityTone[
                  row.priority as keyof typeof maintenancePriorityTone
                ] ?? "neutral"
              }
            >
              {maintenancePriorityLabels[
                row.priority as keyof typeof maintenancePriorityLabels
              ] ??
                row.priority ??
                "—"}
            </StatusBadge>
          ),
        },
        {
          key: "action",
          header: "الإجراء",
          render: (row) => {
            const actions = getMaintenanceStatusActions(
              (row.status ?? "") as keyof typeof maintenanceStatusLabels,
            );
            return actions.length === 0 ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                مكتمل
              </span>
            ) : (
              <div
                className="flex"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <ActionMenu
                  label="تحديث الطلب"
                  items={[
                    {
                      id: "details",
                      label: "التفاصيل",
                      icon: Eye,
                      onClick: () => onViewDetails(row),
                    },
                    {
                      id: "edit",
                      label: "تعديل",
                      icon: Edit,
                      onClick: () => onEdit(row),
                    },
                    ...actions.map((action) => ({
                      id: String(action.status),
                      label: action.label,
                      onClick: () => onStatusAction(row, action.status),
                      disabled: actionsPending,
                    })),
                  ]}
                />
              </div>
            );
          },
        },
      ]}
      keyOf={(row) => row.id}
      emptyTitle="لا توجد طلبات صيانة"
      emptyDescription="لا توجد طلبات تطابق الفلاتر الحالية."
        renderMobileCard={(row) => <MaintenanceCard {...props} row={row} />}
      />
    </div>
  );
}
