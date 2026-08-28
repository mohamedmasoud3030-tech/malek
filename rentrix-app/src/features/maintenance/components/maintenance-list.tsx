import { CheckCircle2, Edit, Eye } from "lucide-react";
import { useState } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { DataTableColumnsMenu } from "@/components/ui/data-table";
import { EntityTable, type ColumnDef } from "@/components/ui/entity-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import type { Property, Unit } from "@/types/domain";
import type { ServiceProviderOption } from "@/features/service-providers/service-provider-service";
import type { Maintenance } from "../maintenance-service";
import {
  buildMaintenanceLocationLabel,
  type MaintenanceStatusFilter,
} from "../maintenance-helpers";
import { getMaintenanceStatusActions } from "../useMaintenancePageController";
import {
  maintenanceAttentionLabels,
  type MaintenanceAttention,
} from "../maintenance-attention";

export const maintenanceStatusLabels = {
  open: "مفتوح",
  in_progress: "قيد التنفيذ",
  resolved: "تم التنفيذ",
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

const maintenanceColumnOptions = [
  { key: "title", label: "العنوان", locked: true },
  { key: "location", label: "الموقع" },
  { key: "provider", label: "مزود الخدمة" },
  { key: "status", label: "الحالة" },
  { key: "attention", label: "المتابعة" },
  { key: "priority", label: "الأولوية" },
  { key: "action", label: "الإجراء", locked: true },
] as const;

const defaultMaintenanceColumns = maintenanceColumnOptions.map((column) => column.key);

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
  attentionByRequestId?: ReadonlyMap<string, MaintenanceAttention>;
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
    attentionByRequestId,
  } = props;
  const { canAccess } = useAuth();
  const canEdit = canAccess("maintenance.edit");
  const canResolve = canAccess("maintenance.resolve");
  const canCancel = canAccess("maintenance.cancel");
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultMaintenanceColumns]);

  const canRunStatusAction = (status: Exclude<MaintenanceStatusFilter, "all">) => {
    if (status === "cancelled") return canCancel;
    if (status === "resolved" || status === "closed") return canResolve;
    return canEdit;
  };

  const columns: ColumnDef<Maintenance>[] = [
    {
      key: "title",
      header: "العنوان",
      priority: "identity",
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "location",
      header: "الموقع",
      priority: "secondary",
      render: (row) => buildMaintenanceLocationLabel(row, properties, allUnits),
    },
    {
      key: "provider",
      header: "مزود الخدمة",
      priority: "detail",
      render: (row) =>
        providerOptions.find((provider) => provider.id === row.service_provider_id)?.name
        ?? (row.service_provider_id ? "مزود مؤرشف أو غير متاح" : "غير معين"),
    },
    {
      key: "status",
      header: "الحالة",
      priority: "primary",
      render: (row) => (
        <StatusBadge
          tone={maintenanceStatusTone[row.status as keyof typeof maintenanceStatusTone] ?? "neutral"}
        >
          {maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels]
            ?? row.status
            ?? "—"}
        </StatusBadge>
      ),
    },
    {
      key: "attention",
      header: "المتابعة",
      priority: "secondary",
      render: (row) => {
        const attention = attentionByRequestId?.get(row.id);
        const showAge = attention !== undefined && attention.ageDays !== null && attention.ageDays > 0;
        if (!attention || (attention.flags.length === 0 && !showAge)) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {attention.flags.map((flag) => (
              <StatusBadge key={flag} tone={flag === "awaiting_closure" ? "info" : "warning"}>
                {maintenanceAttentionLabels[flag]}
              </StatusBadge>
            ))}
            {showAge ? (
              <span className="text-xs text-muted-foreground">منذ {attention.ageDays} يوم</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "priority",
      header: "الأولوية",
      priority: "secondary",
      render: (row) => (
        <StatusBadge
          tone={maintenancePriorityTone[row.priority as keyof typeof maintenancePriorityTone] ?? "neutral"}
        >
          {maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels]
            ?? row.priority
            ?? "—"}
        </StatusBadge>
      ),
    },
    {
      key: "action",
      header: "الإجراء",
      priority: "actions",
      render: (row) => {
        const availableStatusActions = getMaintenanceStatusActions(
          (row.status ?? "") as keyof typeof maintenanceStatusLabels,
        );
        const allowedStatusActions = availableStatusActions.filter((action) => canRunStatusAction(action.status));
        const menuItems = [
          {
            id: "details",
            label: "التفاصيل",
            icon: Eye,
            onClick: () => onViewDetails(row),
          },
          ...(canEdit ? [{
            id: "edit",
            label: "تعديل",
            icon: Edit,
            onClick: () => onEdit(row),
          }] : []),
          ...allowedStatusActions.map((action) => ({
            id: String(action.status),
            label: action.label,
            onClick: () => onStatusAction(row, action.status),
            disabled: actionsPending,
          })),
        ];

        if (menuItems.length === 1 && availableStatusActions.length === 0 && !canEdit) {
          return (
            <Button type="button" variant="ghost" size="sm" onClick={() => onViewDetails(row)}>
              <Eye className="me-1 size-4" />
              التفاصيل
            </Button>
          );
        }

        if (availableStatusActions.length === 0 && !canEdit) {
          return (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              مكتمل
            </span>
          );
        }

        return (
          <div
            className="flex"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <ActionMenu label="إجراءات الطلب" items={menuItems} />
          </div>
        );
      },
    },
  ];

  return (
    <div data-visual-wave="malek-pro" data-maintenance-list>
      <EntityTable
        aria-label="جدول طلبات الصيانة"
        rows={rows}
        columns={columns}
        visibleColumnKeys={visibleColumnKeys}
        toolbar={(
          <div className="flex justify-end">
            <DataTableColumnsMenu
              columns={maintenanceColumnOptions}
              visibleKeys={visibleColumnKeys}
              onChange={setVisibleColumnKeys}
            />
          </div>
        )}
        keyOf={(row) => row.id}
        mobileBadgeKey="status"
        mobileSummaryKeys={["attention", "priority", "location", "provider"]}
        emptyTitle="لا توجد طلبات صيانة"
        emptyDescription="لا توجد طلبات تطابق الفلاتر الحالية."
      />
    </div>
  );
}
