import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { CalendarClock, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
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

interface ExpiringContractsSectionProps {
  rows: ExpiringContractRow[];
  /** Server-authoritative 30-day expiring contract count. */
  totalCount?: number;
  isLoading: boolean;
  isError?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

export function ExpiringContractsSection({ rows, totalCount, isLoading, isError = false, settings }: ExpiringContractsSectionProps) {
  const badgeCount = totalCount ?? rows.length;
  const visibleRows = rows.slice(0, 3);
  const { date } = settings;
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <DashboardSignalPanel labelledBy="expiring-contracts-title">
      <DashboardSignalHeader
        id="expiring-contracts-title"
        title="عقود تنتهي قريباً"
        meta={`خلال ${DASHBOARD_WINDOW_DAYS} يوماً`}
        icon={CalendarClock}
        tone={badgeCount > 0 ? 'warning' : 'success'}
        trailing={(
          <>
            {!isLoading && !isError ? <StatusBadge tone={badgeCount > 0 ? 'warning' : 'success'}>{badgeCount}</StatusBadge> : null}
            <Link to="/contracts" data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>
          </>
        )}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل العقود القريبة من الانتهاء" /> : null}

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
}
