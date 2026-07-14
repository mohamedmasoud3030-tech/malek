import { CheckCircle2, Edit, Eye } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Property, Unit } from '@/types/domain';
import type { Maintenance } from '../maintenance-service';
import { buildMaintenanceLocationLabel, type MaintenanceStatusFilter } from '../maintenance-helpers';
import { getMaintenanceStatusActions } from '../useMaintenancePageController';

export const maintenanceStatusLabels = {
  open: 'مفتوح',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم الحل',
  closed: 'مغلق',
} as const;

export const maintenanceStatusTone = {
  open: 'blue',
  in_progress: 'gold',
  resolved: 'green',
  closed: 'gray',
} as const;

export const maintenancePriorityLabels = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
} as const;

export const maintenancePriorityTone = {
  low: 'gray',
  medium: 'blue',
  high: 'gold',
  urgent: 'red',
} as const;

export type MaintenanceListProps = Readonly<{
  rows: Maintenance[];
  properties: Property[];
  allUnits: Unit[];
  actionsPending: boolean;
  onViewDetails: (row: Maintenance) => void;
  onEdit: (row: Maintenance) => void;
  onStatusAction: (row: Maintenance, status: Exclude<MaintenanceStatusFilter, 'all'>) => void;
}>;

/**
 * Renders the filtered maintenance request list as mobile cards (small
 * screens) and a DataTable (md+), including the per-row status-progression
 * action menu. Pure presentation — all state/handlers come from the parent
 * controller hook.
 */
export function MaintenanceList({ rows, properties, allUnits, actionsPending, onViewDetails, onEdit, onStatusAction }: MaintenanceListProps) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 md:hidden">
        {rows.map((row) => {
          const actions = getMaintenanceStatusActions((row.status ?? '') as keyof typeof maintenanceStatusLabels);
          return (
            <MobileCard
              key={row.id}
              title={row.title}
              subtitle={buildMaintenanceLocationLabel(row, properties, allUnits)}
              badge={(
                <StatusBadge tone={maintenanceStatusTone[row.status as keyof typeof maintenanceStatusTone] ?? 'gray'}>
                  {maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status ?? '—'}
                </StatusBadge>
              )}
              meta={(
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-muted-foreground">الأولوية</span>
                  <StatusBadge tone={maintenancePriorityTone[row.priority as keyof typeof maintenancePriorityTone] ?? 'gray'}>
                    {maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority ?? '—'}
                  </StatusBadge>
                </div>
              )}
              actions={actions.length > 0 ? (
                <div className="grid w-full grid-cols-1 gap-2">
                  <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" onClick={() => onViewDetails(row)}><Eye className="me-2 size-4" aria-hidden="true" />التفاصيل</Button>
                  <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" onClick={() => onEdit(row)}><Edit className="me-2 size-4" aria-hidden="true" />تعديل</Button>
                  {actions.map((action) => (
                    <Button
                      key={`${row.id}-${action.status}`}
                      type="button"
                      variant="secondary"
                      className="min-h-11 px-3 text-xs"
                      disabled={actionsPending}
                      onClick={() => onStatusAction(row, action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <span className="flex min-h-11 items-center gap-1 text-xs font-bold text-muted-foreground">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />مكتمل
                </span>
              )}
            />
          );
        })}
      </div>

      <div className="hidden md:block">
        <DataTable
          aria-label="جدول طلبات الصيانة"
          rows={rows}
          columns={[
            { key: 'title', header: 'العنوان', render: (row) => <span className="font-medium">{row.title}</span> },
            { key: 'location', header: 'الموقع', render: (row) => buildMaintenanceLocationLabel(row, properties, allUnits) },
            { key: 'status', header: 'الحالة', render: (row) => (
              <StatusBadge tone={maintenanceStatusTone[row.status as keyof typeof maintenanceStatusTone] ?? 'gray'}>
                {maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status ?? '—'}
              </StatusBadge>
            ) },
            { key: 'priority', header: 'الأولوية', render: (row) => (
              <StatusBadge tone={maintenancePriorityTone[row.priority as keyof typeof maintenancePriorityTone] ?? 'gray'}>
                {maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority ?? '—'}
              </StatusBadge>
            ) },
            { key: 'action', header: 'الإجراء', render: (row) => {
              const actions = getMaintenanceStatusActions((row.status ?? '') as keyof typeof maintenanceStatusLabels);
              return actions.length === 0 ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" />مكتمل</span>
              ) : (
                <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <ActionMenu
                    label="تحديث الطلب"
                    items={[{ id: 'details', label: 'التفاصيل', icon: Eye, onClick: () => onViewDetails(row) }, { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => onEdit(row) }, ...actions.map((action) => ({
                      id: String(action.status),
                      label: action.label,
                      onClick: () => onStatusAction(row, action.status),
                      disabled: actionsPending,
                    }))]}
                  />
                </div>
              );
            } },
          ]}
          keyOf={(row) => row.id}
          emptyTitle="لا توجد طلبات صيانة"
          emptyDescription="لا توجد طلبات تطابق الفلاتر الحالية."
        />
      </div>
    </>
  );
}
