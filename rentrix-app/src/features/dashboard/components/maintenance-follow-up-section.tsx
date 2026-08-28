import { Link } from '@tanstack/react-router';
import { History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { MaintenanceFollowUpSignal } from '../maintenance-follow-up-signal';

interface MaintenanceFollowUpSectionProps {
  signal: MaintenanceFollowUpSignal;
  isLoading: boolean;
  isError?: boolean;
}

/**
 * P3 — Today: maintenance that stopped moving.
 *
 * Complements the urgent-maintenance queue. Urgency is how a request was
 * *reported*; this card is about what actually happened to it afterwards —
 * work stalled, a visit missed, or a finished job nobody closed.
 */
export function MaintenanceFollowUpSection({ signal, isLoading, isError = false }: MaintenanceFollowUpSectionProps) {
  const meta = signal.stalledCount > 0
    ? `${signal.stalledCount} طلب متوقف عن التقدم`
    : signal.awaitingClosureCount > 0
      ? `${signal.awaitingClosureCount} طلب بانتظار الإغلاق`
      : 'الطلبات تتحرك ضمن المدة المعتادة';

  return (
    <section className="dashboard-queue-card" aria-labelledby="maintenance-follow-up-title">
      <div className="dashboard-queue-card__header">
        <div className="dashboard-queue-card__title-group">
          <span
            className={cn('dashboard-queue-card__icon', signal.actionableCount > 0 ? 'dashboard-queue-card__icon--warning' : undefined)}
            aria-hidden="true"
          >
            <History className="size-4" />
          </span>
          <div>
            <h3 id="maintenance-follow-up-title" className="dashboard-queue-card__title">متابعة الصيانة</h3>
            <p className="dashboard-queue-card__meta">{meta}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && !isError ? (
            <StatusBadge tone={signal.actionableCount > 0 ? 'warning' : 'success'}>{signal.actionableCount}</StatusBadge>
          ) : null}
          <Link to="/maintenance" data-dashboard-section-action className="dashboard-section-link">عرض الكل</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="dashboard-queue-list" aria-label="جارٍ تحميل متابعة الصيانة">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : null}

      {!isLoading && isError ? (
        <div className="dashboard-queue-empty" role="alert">
          <p className="font-semibold">تعذر تحميل متابعة الصيانة</p>
          <p>افتح سجل الصيانة للتحقق. لن نعرض قائمة فارغة عند فشل التحميل.</p>
        </div>
      ) : null}

      {!isLoading && !isError && signal.rows.length === 0 ? (
        <div className="dashboard-queue-empty" role="status">
          <p className="font-semibold">لا توجد طلبات متعثرة</p>
          <p>ستظهر هنا الطلبات التي توقفت عن التقدم أو انتهى العمل فيها بلا إغلاق.</p>
        </div>
      ) : null}

      {!isLoading && !isError && signal.rows.length > 0 ? (
        <ul className="dashboard-queue-list" role="list">
          {signal.rows.map((row) => (
            <li key={row.requestId} role="listitem" className="min-w-0">
              <Link
                to="/maintenance"
                className={cn('dashboard-queue-row', row.flag === 'awaiting_closure' ? undefined : 'dashboard-queue-row--warning')}
                data-dashboard-queue-link
                aria-label={`${row.title} — ${row.location} — ${row.flagLabel}`}
              >
                <span className="dashboard-queue-row__main">
                  <span className="dashboard-queue-row__title">{row.title}</span>
                  <span className="dashboard-queue-row__meta">{row.location}</span>
                </span>
                <span className="dashboard-queue-row__side">
                  <StatusBadge tone={row.flag === 'awaiting_closure' ? 'info' : 'warning'}>{row.flagLabel}</StatusBadge>
                  {row.ageDays !== null ? (
                    <span className="dashboard-queue-row__date">منذ {row.ageDays} يوم</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
