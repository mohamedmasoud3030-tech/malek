import { CheckCircle2, Edit, Eye } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Property, Unit } from "@/types/domain";
import type { ServiceProviderOption } from "@/features/service-providers/service-provider-service";
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
  providerOptions: ServiceProviderOption[];
  actionsPending: boolean;
  onViewDetails: (row: Maintenance) => void;
  onEdit: (row: Maintenance) => void;
  onStatusAction: (
    row: Maintenance,
    status: Exclude<MaintenanceStatusFilter, "all">,
  ) => void;
}>;

export function MaintenanceList(props: MaintenanceListProps) {
  const {
    rows,
    properties,
    allUnits,
    providerOptions,
    actionsPending,
    onViewDetails,
    onEdit,
    onStatusAction,
  } = props;

  return (
    <div data-visual-wave="malek-pro">
      <DataTable
        aria-label="جدول طلبات الصيانة"
        mobileVisibleSecondaryKey="status"
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
          key: "provider",
          header: "مزود الخدمة",
          render: (row) => providerOptions.find((provider) => provider.id === row.service_provider_id)?.name ?? (row.service_provider_id ? 'مزود مؤرشف أو غير متاح' : 'غير معين'),
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

      />
    </div>
  );
}
