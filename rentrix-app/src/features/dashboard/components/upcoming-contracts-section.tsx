import { memo } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { CalendarClock, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { DASHBOARD_WINDOW_DAYS, type ExpiringContractRow } from '../dashboard-utils';
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

interface UpcomingContractsSectionProps {
  rows: readonly ExpiringContractRow[];
  /** Server-authoritative cumulative expiry windows (as-of based). */
  expiring30?: number;
  expiring60?: number;
  expiring90?: number;
  isLoading: boolean;
  isError?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

/**
 * Upcoming contracts around actionable time buckets. The bucket counts are
 * derived from the server's cumulative 30/60/90 windows — the dashboard
 * never recounts contracts from row reads.
 */
export const UpcomingContractsSection = memo(function UpcomingContractsSection({
  rows,
  expiring30,
  expiring60,
  expiring90,
  isLoading,
  isError = false,
  settings,
}: UpcomingContractsSectionProps) {
  const { date } = settings;
  const navigate = useNavigate();
  const location = useLocation();
  const visibleRows = rows.slice(0, 3);
  const within30 = expiring30 ?? 0;
  const within60 = Math.max(0, (expiring60 ?? 0) - within30);
  const within90 = Math.max(0, (expiring90 ?? 0) - (expiring60 ?? 0));
  const badgeCount = expiring30 ?? rows.length;

  const buckets = [
    { label: '≤ 30 يوماً', count: within30, tone: within30 > 0 ? 'danger' : 'neutral' },
    { label: '31–60 يوماً', count: within60, tone: within60 > 0 ? 'warning' : 'neutral' },
    { label: '61–90 يوماً', count: within90, tone: within90 > 0 ? 'info' : 'neutral' },
  ] as const;

  return (
    <DashboardSignalPanel labelledBy="upcoming-contracts-title" className="h-full">
      <DashboardSignalHeader
        id="upcoming-contracts-title"
        title="العقود القادمة"
        meta={`تنتهي خلال ${DASHBOARD_WINDOW_DAYS} يوماً — قرار التجديد أو الإخلاء`}
        icon={CalendarClock}
        tone={badgeCount > 0 ? 'warning' : 'success'}
        trailing={(
          <>
            {!isLoading && !isError ? <StatusBadge tone={badgeCount > 0 ? 'warning' : 'success'}>{badgeCount}</StatusBadge> : null}
            <Link to="/contracts" data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>
          </>
        )}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل العقود القريبة من الانتهاء" /> : (
        <div className="grid grid-cols-3 gap-2 border-t border-border/70 bg-muted/20 p-3 sm:px-4" data-dashboard-contract-buckets>
          {buckets.map((bucket) => (
            <div key={bucket.label} className={cn('min-w-0 rounded-lg bg-card px-2 py-1.5 text-center')}>
              <p className="text-[11px] font-bold text-muted-foreground">{bucket.label}</p>
              <p className={cn(
                'mt-0.5 text-lg font-black tabular-nums',
                bucket.tone === 'danger' ? 'text-danger' : bucket.tone === 'warning' ? 'text-warning' : bucket.tone === 'info' ? 'text-info' : 'text-foreground',
              )}
              >
                {bucket.count}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل العقود القريبة من الانتهاء"
          description="راجع تنبيه أعلى الصفحة ثم أعد المحاولة. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}

      {!isLoading && !isError && visibleRows.length === 0 ? (
        <DashboardSignalEmpty title="لا توجد عقود تنتهي قريباً" description="ستظهر هنا العقود التي تحتاج قرار تجديد أو إخلاء." />
      ) : null}

      {!isLoading && !isError && visibleRows.length > 0 ? (
        <DashboardSignalList label="العقود القريبة من الانتهاء">
          {visibleRows.map((row) => {
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
                  className={dashboardSignalRowClass(tone)}
                  data-dashboard-queue-link
                  aria-label={`${row.tenantName} — عقد ينتهي خلال ${row.daysRemaining} يوم`}
                >
                  <DashboardSignalMain title={row.tenantName} meta={row.location} />
                  <DashboardSignalSide>
                    <StatusBadge tone={tone}>
                      <Clock className="size-3" aria-hidden="true" />
                      {row.daysRemaining} يوم
                    </StatusBadge>
                    <span className="hidden sm:inline">ينتهي: {date(row.endDate)}</span>
                  </DashboardSignalSide>
                </button>
              </li>
            );
          })}
        </DashboardSignalList>
      ) : null}
    </DashboardSignalPanel>
  );
});
