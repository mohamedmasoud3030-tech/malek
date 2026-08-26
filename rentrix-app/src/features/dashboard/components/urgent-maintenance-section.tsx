import { Link } from '@tanstack/react-router';
import { AlertTriangle, Wrench } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import type { DashboardQueueMaintenanceRow } from '../dashboard-snapshot';

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
    <section className="dashboard-queue-card" aria-labelledby="urgent-maintenance-title">
      <div className="dashboard-queue-card__header">
        <div className="dashboard-queue-card__title-group">
          <span className="dashboard-queue-card__icon dashboard-queue-card__icon--danger" aria-hidden="true">
            <Wrench className="size-4" />
          </span>
          <div>
            <h3 id="urgent-maintenance-title" className="dashboard-queue-card__title">الصيانة العاجلة</h3>
            <p className="dashboard-queue-card__meta">طلبات تحتاج تدخلاً قريباً</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && !isError ? <StatusBadge tone={badgeCount > 0 ? 'danger' : 'success'}>{badgeCount}</StatusBadge> : null}
          <Link to="/maintenance" data-dashboard-section-action className="dashboard-section-link">عرض الكل</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="dashboard-queue-list" aria-label="جارٍ تحميل الصيانة العاجلة">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : null}

      {!isLoading && isError ? (
        <div className="dashboard-queue-empty" role="alert">
          <p className="font-semibold">تعذر تحميل الصيانة العاجلة</p>
          <p>راجع تنبيه أعلى الصفحة ثم أعد المحاولة.</p>
        </div>
      ) : null}

      {!isLoading && !isError && visibleRows.length === 0 ? (
        <div className="dashboard-queue-empty" role="status">
          <p className="font-semibold">لا توجد صيانة عاجلة الآن</p>
          <p>ستظهر هنا الطلبات العاجلة عندما تحتاج متابعة.</p>
        </div>
      ) : null}

      {!isLoading && !isError && visibleRows.length > 0 ? (
        <ul className="dashboard-queue-list" role="list">
          {visibleRows.map((row) => (
            <li key={row.id} role="listitem" className="min-w-0">
              <Link
                to="/maintenance"
                className="dashboard-queue-row dashboard-queue-row--danger"
                data-dashboard-queue-link
                aria-label={`${row.title || 'طلب صيانة عاجل'} — ${maintenanceLocation(row)}`}
              >
                <span className="dashboard-queue-row__main">
                  <span className="dashboard-queue-row__title">{row.title || 'طلب صيانة عاجل'}</span>
                  <span className="dashboard-queue-row__meta">{maintenanceLocation(row)}</span>
                </span>
                <span className="dashboard-queue-row__side">
                  <StatusBadge tone="danger">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    عاجل
                  </StatusBadge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
