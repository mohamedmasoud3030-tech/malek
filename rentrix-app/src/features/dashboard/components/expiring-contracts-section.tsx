import { Link } from '@tanstack/react-router';
import { CalendarClock, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { DASHBOARD_WINDOW_DAYS, type ExpiringContractRow } from '../dashboard-utils';

interface ExpiringContractsSectionProps {
  rows: ExpiringContractRow[];
  isLoading: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

export function ExpiringContractsSection({ rows, isLoading, settings }: ExpiringContractsSectionProps) {
  const { date } = settings;
  return (
    <section className="dashboard-queue-card" aria-labelledby="expiring-contracts-title">
      <div className="dashboard-queue-card__header">
        <div className="dashboard-queue-card__title-group">
          <span className="dashboard-queue-card__icon" aria-hidden="true">
            <CalendarClock className="size-4" />
          </span>
          <div>
            <h3 id="expiring-contracts-title" className="dashboard-queue-card__title">العقود المنتهية قريباً</h3>
            <p className="dashboard-queue-card__meta">نافذة {DASHBOARD_WINDOW_DAYS} يوماً</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading ? <StatusBadge tone={rows.length > 0 ? 'warning' : 'success'}>{rows.length}</StatusBadge> : null}
          <Link to="/contracts" data-dashboard-section-action className="dashboard-section-link">عرض الكل</Link>
        </div>
      </div>

      {isLoading && (
        <div className="dashboard-queue-list" aria-label="جارٍ تحميل العقود المنتهية قريباً">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="dashboard-queue-empty" role="status">
          <p className="font-semibold">لا توجد عقود تنتهي قريباً</p>
          <p>ستظهر هنا العقود القريبة من الانتهاء عند توفرها.</p>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="dashboard-queue-list" role="list">
          {rows.map((row) => {
            const tone = row.daysRemaining <= 7 ? 'danger' : row.daysRemaining <= 14 ? 'warning' : 'success';
            return (
              <Link
                key={row.id}
                to="/contracts/$contractId"
                params={{ contractId: row.id }}
                className={cn('dashboard-queue-row', row.daysRemaining <= 7 && 'dashboard-queue-row--danger', row.daysRemaining > 7 && row.daysRemaining <= 14 && 'dashboard-queue-row--warning')}
                data-dashboard-queue-link
                role="listitem"
              >
                <span className="dashboard-queue-row__main">
                  <span className="dashboard-queue-row__title">{row.tenantName}</span>
                  <span className="dashboard-queue-row__meta">{row.location}</span>
                </span>
                <span className="dashboard-queue-row__side">
                  <StatusBadge tone={tone}>
                    <Clock className="size-3" aria-hidden="true" />
                    {row.daysRemaining} يوم
                  </StatusBadge>
                  <span className="dashboard-queue-row__date">ينتهي: {date(row.endDate)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
