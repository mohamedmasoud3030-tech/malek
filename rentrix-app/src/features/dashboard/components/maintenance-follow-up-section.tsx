import { Link } from '@tanstack/react-router';
import { History } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { MaintenanceFollowUpSignal } from '../maintenance-follow-up-signal';
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

interface MaintenanceFollowUpSectionProps {
  signal: MaintenanceFollowUpSignal;
  isLoading: boolean;
  isError?: boolean;
}

/**
 * P3 — Today: maintenance that stopped moving.
 * Urgency is how a request was reported; this signal is about what actually
 * happened afterwards — work stalled, a visit missed, or a finished job that
 * still needs closure.
 */
export function MaintenanceFollowUpSection({ signal, isLoading, isError = false }: MaintenanceFollowUpSectionProps) {
  const meta = signal.stalledCount > 0
    ? `${signal.stalledCount} طلب متوقف عن التقدم`
    : signal.awaitingClosureCount > 0
      ? `${signal.awaitingClosureCount} طلب بانتظار الإغلاق`
      : 'الطلبات تتحرك ضمن المدة المعتادة';

  return (
    <DashboardSignalPanel labelledBy="maintenance-follow-up-title">
      <DashboardSignalHeader
        id="maintenance-follow-up-title"
        title="متابعة الصيانة"
        meta={meta}
        icon={History}
        tone={signal.actionableCount > 0 ? 'warning' : 'success'}
        trailing={(
          <>
            {!isLoading && !isError ? (
              <StatusBadge tone={signal.actionableCount > 0 ? 'warning' : 'success'}>{signal.actionableCount}</StatusBadge>
            ) : null}
            <Link to="/maintenance" data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>
          </>
        )}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل متابعة الصيانة" /> : null}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل متابعة الصيانة"
          description="افتح سجل الصيانة للتحقق. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}

      {!isLoading && !isError && signal.rows.length === 0 ? (
        <DashboardSignalEmpty
          title="لا توجد طلبات متعثرة"
          description="ستظهر هنا الطلبات التي توقفت عن التقدم أو انتهى العمل فيها بلا إغلاق."
        />
      ) : null}

      {!isLoading && !isError && signal.rows.length > 0 ? (
        <DashboardSignalList label="متابعة الصيانة">
          {signal.rows.map((row) => {
            const tone = row.flag === 'awaiting_closure' ? 'info' : 'warning';
            return (
              <li key={row.requestId} role="listitem" className="min-w-0">
                <Link
                  to="/maintenance"
                  className={dashboardSignalRowClass(tone)}
                  data-dashboard-queue-link
                  aria-label={`${row.title} — ${row.location} — ${row.flagLabel}`}
                >
                  <DashboardSignalMain title={row.title} meta={row.location} />
                  <DashboardSignalSide>
                    <StatusBadge tone={tone}>{row.flagLabel}</StatusBadge>
                    {row.ageDays !== null ? <span className="hidden sm:inline">منذ {row.ageDays} يوم</span> : null}
                  </DashboardSignalSide>
                </Link>
              </li>
            );
          })}
        </DashboardSignalList>
      ) : null}
    </DashboardSignalPanel>
  );
}
