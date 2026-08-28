import { Link } from '@tanstack/react-router';
import { AlertTriangle, Wrench } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { DashboardQueueMaintenanceRow } from '../dashboard-snapshot';
import {
  DashboardSignalEmpty,
  DashboardSignalHeader,
  DashboardSignalList,
  DashboardSignalLoading,
  DashboardSignalMain,
  DashboardSignalPanel,
  DashboardSignalSide,
  dashboardSectionActionClass,
  dashboardSignalRowClass,
} from './dashboard-signal-primitives';

interface UrgentMaintenanceSectionProps {
  rows: DashboardQueueMaintenanceRow[];
  totalCount?: number;
  isLoading: boolean;
  isError?: boolean;
}

function maintenanceLocation(row: DashboardQueueMaintenanceRow) {
  return [row.propertyTitle, row.unitNumber ? `الوحدة ${row.unitNumber}` : null].filter(Boolean).join(' · ') || 'الموقع غير محدد';
}

export function UrgentMaintenanceSection({ rows, totalCount, isLoading, isError = false }: UrgentMaintenanceSectionProps) {
  const badgeCount = totalCount ?? rows.length;
  const visibleRows = rows.slice(0, 3);

  return (
    <DashboardSignalPanel labelledBy="urgent-maintenance-title">
      <DashboardSignalHeader
        id="urgent-maintenance-title"
        title="الصيانة العاجلة"
        meta="طلبات تحتاج تدخلاً قريباً"
        icon={Wrench}
        tone={badgeCount > 0 ? 'danger' : 'success'}
        trailing={(
          <>
            {!isLoading && !isError ? <StatusBadge tone={badgeCount > 0 ? 'danger' : 'success'}>{badgeCount}</StatusBadge> : null}
            <Link to="/maintenance" data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>
          </>
        )}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل الصيانة العاجلة" /> : null}

      {!isLoading && isError ? (
        <DashboardSignalEmpty role="alert" title="تعذر تحميل الصيانة العاجلة" description="راجع تنبيه أعلى الصفحة ثم أعد المحاولة." />
      ) : null}

      {!isLoading && !isError && visibleRows.length === 0 ? (
        <DashboardSignalEmpty title="لا توجد صيانة عاجلة الآن" description="ستظهر هنا الطلبات العاجلة عندما تحتاج متابعة." />
      ) : null}

      {!isLoading && !isError && visibleRows.length > 0 ? (
        <DashboardSignalList label="الصيانة العاجلة">
          {visibleRows.map((row) => (
            <li key={row.id} role="listitem" className="min-w-0">
              <Link
                to="/maintenance"
                className={dashboardSignalRowClass('danger')}
                data-dashboard-queue-link
                aria-label={`${row.title || 'طلب صيانة عاجل'} — ${maintenanceLocation(row)}`}
              >
                <DashboardSignalMain title={row.title || 'طلب صيانة عاجل'} meta={maintenanceLocation(row)} />
                <DashboardSignalSide>
                  <StatusBadge tone="danger">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    عاجل
                  </StatusBadge>
                </DashboardSignalSide>
              </Link>
            </li>
          ))}
        </DashboardSignalList>
      ) : null}
    </DashboardSignalPanel>
  );
}
