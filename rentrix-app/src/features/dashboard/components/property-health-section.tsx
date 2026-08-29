import { Link } from '@tanstack/react-router';
import { Building2, Stethoscope } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import {
  propertyHealthLabels,
  type PropertyHealthRow,
  type PropertyHealthStatus,
} from '../property-health-signal';
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

/** Only the worst/highest-priority properties belong on the command center. */
export const PROPERTY_HEALTH_VISIBLE_LIMIT = 4;

interface PropertyHealthSectionProps {
  rows: readonly PropertyHealthRow[];
  isLoading: boolean;
  isError?: boolean;
}

const statusTone: Record<PropertyHealthStatus, 'danger' | 'warning' | 'success'> = {
  critical: 'danger',
  watch: 'warning',
  good: 'success',
};

function healthMeta(row: PropertyHealthRow): string {
  const parts = [`${row.occupancyRate}% إشغال`];
  if (row.vacantUnits > 0) parts.push(`${row.vacantUnits} وحدة شاغرة`);
  if (row.longestVacancyDays > 0) parts.push(`أطول شغور ${row.longestVacancyDays} يوم`);
  if (row.openMaintenance > 0) {
    parts.push(row.urgentMaintenance > 0
      ? `${row.openMaintenance} صيانة نشطة منها ${row.urgentMaintenance} عاجلة`
      : `${row.openMaintenance} صيانة نشطة`);
  }
  return parts.join(' · ');
}

/**
 * Property health — transparent, deterministic indicators. Every label is
 * explained by the metrics printed next to it; there is no opaque score.
 */
export function PropertyHealthSection({ rows, isLoading, isError = false }: PropertyHealthSectionProps) {
  const visibleRows = rows.slice(0, PROPERTY_HEALTH_VISIBLE_LIMIT);
  const criticalCount = rows.reduce((count, row) => count + (row.status === 'critical' ? 1 : 0), 0);

  return (
    <DashboardSignalPanel labelledBy="property-health-title" className="h-full">
      <DashboardSignalHeader
        id="property-health-title"
        title="صحة العقارات"
        meta={
          criticalCount > 0
            ? `${criticalCount} عقار يحتاج تدخل`
            : rows.length > 0
              ? 'المؤشرات من الإشغال والشغور والصيانة'
              : 'حالة المحفظة العقارية'
        }
        icon={Stethoscope}
        tone={criticalCount > 0 ? 'danger' : rows.some((row) => row.status === 'watch') ? 'warning' : 'success'}
        trailing={<Link to="/properties" data-dashboard-section-action className={dashboardSectionActionClass}>المحفظة</Link>}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل صحة العقارات" /> : null}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل صحة العقارات"
          description="افتح المحفظة العقارية للتحقق. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <DashboardSignalEmpty title="لا توجد عقارات بوحدات بعد" description="أضف عقارك ووحداتك لتظهر صحتها هنا." />
      ) : null}

      {!isLoading && !isError && visibleRows.length > 0 ? (
        <DashboardSignalList label="صحة العقارات ذات الأولوية">
          {visibleRows.map((row) => (
            <li key={row.propertyId} role="listitem" className="min-w-0">
              <Link
                to="/properties/$propertyId"
                params={{ propertyId: row.propertyId }}
                className={dashboardSignalRowClass(statusTone[row.status])}
                data-dashboard-queue-link
                aria-label={`${row.title} — ${propertyHealthLabels[row.status]} — ${healthMeta(row)}`}
              >
                <DashboardSignalMain title={row.title} meta={healthMeta(row)} />
                <DashboardSignalSide>
                  <StatusBadge tone={statusTone[row.status]}>
                    <Building2 className="size-3" aria-hidden="true" />
                    {propertyHealthLabels[row.status]}
                  </StatusBadge>
                  <span className={cn('hidden text-[11px] font-bold tabular-nums sm:inline', row.occupancyRate < 80 ? 'text-danger' : 'text-muted-foreground')} dir="ltr">
                    {row.occupancyRate}%
                  </span>
                </DashboardSignalSide>
              </Link>
            </li>
          ))}
        </DashboardSignalList>
      ) : null}
    </DashboardSignalPanel>
  );
}
