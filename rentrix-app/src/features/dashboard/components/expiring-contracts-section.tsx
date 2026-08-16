import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { CalendarClock, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { DASHBOARD_WINDOW_DAYS, type ExpiringContractRow } from '../dashboard-utils';

interface ExpiringContractsSectionProps {
  rows: ExpiringContractRow[];
  /**
   * Server-authoritative 30-day expiring contract count (contracts.expiring_30).
   * The queue rows are a bounded top-5 slice, so rows.length must never be
   * shown as the operational number.
   */
  totalCount?: number;
  isLoading: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

export function ExpiringContractsSection({ rows, totalCount, isLoading, settings }: ExpiringContractsSectionProps) {
  const badgeCount = totalCount ?? rows.length;
  const { date } = settings;
  const navigate = useNavigate();
  const location = useLocation();
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
          {!isLoading ? <StatusBadge tone={badgeCount > 0 ? 'warning' : 'success'}>{badgeCount}</StatusBadge> : null}
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
        /* role="listitem" is invalid on <button>/<a> (axe aria-allowed-role):
           the list is a real <ul> and each row is wrapped in the <li> that
           owns the listitem semantics. */
        <ul className="dashboard-queue-list" role="list">
          {rows.map((row) => {
            const tone = row.daysRemaining <= 7 ? 'danger' : row.daysRemaining <= 14 ? 'warning' : 'success';
            return (
              <li key={row.id} role="listitem" className="min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    (navigate as unknown as (opts: unknown) => void)({
                      to: '/contracts/$contractId',
                      params: { contractId: row.id },
                      state: { backgroundLocation: location } as unknown as Record<string, unknown>,
                    })
                  }
                  className={cn('dashboard-queue-row w-full text-start', row.daysRemaining <= 7 && 'dashboard-queue-row--danger', row.daysRemaining > 7 && row.daysRemaining <= 14 && 'dashboard-queue-row--warning')}
                  data-dashboard-queue-link
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
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
