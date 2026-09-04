import { Download, Edit, Eye, Printer } from "lucide-react";
import { useMemo, type ReactNode } from 'react';
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
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
import {
  getMaintenanceStatusActionPermission,
  getMaintenanceStatusActions,
} from "../useMaintenancePageController";
import {
  maintenanceAttentionLabels,
  type MaintenanceAttention,
} from "../maintenance-attention";

export const maintenanceStatusLabels = {
  open: "مفتوح",
  in_progress: "قيد التنفيذ",
  resolved: "تم التنفيذ",
  closed: "مغلق",
  cancelled: "ملغى",
} as const;

export const maintenanceStatusTone = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "neutral",
  cancelled: "neutral",
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

export const maintenanceColumnOptions = [
  { key: "title", label: "العنوان", locked: true },
  { key: "location", label: "الموقع" },
  { key: "provider", label: "مزود الخدمة" },
  { key: "status", label: "الحالة" },
  { key: "attention", label: "المتابعة" },
  { key: "priority", label: "الأولوية" },
  { key: "action", label: "الإجراء", locked: true },
] as const;

export const defaultMaintenanceColumns = maintenanceColumnOptions.map((column) => column.key);

export type MaintenanceListProps = Readonly<{
  rows: Maintenance[];
  properties: Property[];
  allUnits: Unit[];
  providerOptions: ServiceProviderOption[];
  actionsPending: boolean;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onViewDetails: (row: Maintenance) => void;
  onEdit: (row: Maintenance) => void;
  onStatusAction: (
    row: Maintenance,
    status: Exclude<MaintenanceStatusFilter, "all">,
  ) => void;
  attentionByRequestId?: ReadonlyMap<string, MaintenanceAttention>;
  visibleColumnKeys: readonly string[];
  /**
   * Optional per-row document actions supplied by the workspace. The list
   * only renders what the workspace decided is authoritative for the row
   * (e.g. a completion certificate exists only for resolved/closed work).
   */
  documentActions?: (row: Maintenance) => readonly {
    id: string;
    label: string;
    kind: 'print' | 'download';
    disabled?: boolean;
    onClick: () => void;
  }[];
}>;

export function MaintenanceList(props: MaintenanceListProps) {
  const {
    rows,
    properties,
    allUnits,
    providerOptions,
    actionsPending,
    isLoading = false,
    error,
    onRetry,
    emptyTitle = "لا توجد طلبات صيانة",
    emptyDescription = "لا توجد طلبات تطابق الفلاتر الحالية.",
    emptyAction,
    onViewDetails,
    onEdit,
    onStatusAction,
    attentionByRequestId,
    visibleColumnKeys,
    documentActions,
  } = props;
  const { canAccess } = useAuth();
  const canEdit = canAccess("maintenance.edit");

  // Single source of truth for "may this operator run this transition", shared
  // with the details overlay so both surfaces offer exactly the same actions.
  const canRunStatusAction = (status: Exclude<MaintenanceStatusFilter, "all">) =>
    canAccess(getMaintenanceStatusActionPermission(status));

  const columns = useMemo((): ColumnDef<Maintenance>[] => [
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
      // "Who owns this work" is one question, so the executing party is one
      // cell: the contracted provider plus the technician actually assigned.
      // This adds the assignee to the mobile card without adding a row.
      render: (row) => {
        const providerName = providerOptions.find((provider) => provider.id === row.service_provider_id)?.name
          ?? (row.service_provider_id ? "مزود مؤرشف أو غير متاح" : "غير معين");
        const assignee = row.assigned_to || row.technician_name || null;
        return (
          <span className="block min-w-0">
            <span className="block truncate">{providerName}</span>
            {assignee ? (
              <span className="block truncate text-xs text-muted-foreground">الفني: {assignee}</span>
            ) : null}
          </span>
        );
      },
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
            id: "preview",
            label: "معاينة سريعة",
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
          ...(documentActions?.(row) ?? []).map((action) => ({
            id: action.id,
            label: action.label,
            icon: action.kind === 'print' ? Printer : Download,
            onClick: action.onClick,
            disabled: action.disabled,
          })),
        ];

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
  ], [documentActions]);

  return (
    <div data-maintenance-list>
      <EntityTable
        aria-label="جدول طلبات الصيانة"
        rows={rows}
        columns={columns}
        visibleColumnKeys={visibleColumnKeys}
        keyOf={(row) => row.id}
        isLoading={isLoading}
        error={error}
        errorTitle="تعذر تحميل طلبات الصيانة"
        onRetry={onRetry}
        mobileCardType="maintenance"
        mobileBadgeKey="status"
        mobileSupportingKey="location"
        mobilePrimaryMetaKeys={["priority", "attention"]}
        mobileSecondaryMetaKeys={["provider"]}
        mobileCardPrimaryAction={(row) => ({
          label: "معاينة سريعة",
          icon: Eye,
          variant: "default",
          ariaLabel: `معاينة ${row.title}`,
          onClick: () => onViewDetails(row),
        })}
        mobileCardActions={(row) => {
          const allowedStatusActions = getMaintenanceStatusActions(
            (row.status ?? "") as keyof typeof maintenanceStatusLabels,
          ).filter((action) => canRunStatusAction(action.status));
          return [
            ...(canEdit ? [{
              label: "تعديل",
              icon: Edit,
              variant: "secondary" as const,
              ariaLabel: `تعديل ${row.title}`,
              onClick: () => onEdit(row),
            }] : []),
            ...(!actionsPending ? allowedStatusActions.map((action) => ({
              label: action.label,
              variant: action.status === "cancelled" ? "danger" as const : "secondary" as const,
              ariaLabel: `${action.label} — ${row.title}`,
              onClick: () => onStatusAction(row, action.status),
            })) : []),
          ];
        }}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        onRowClick={(row) => onViewDetails(row)}
      />
    </div>
  );
}
