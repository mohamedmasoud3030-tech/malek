import { Link } from '@tanstack/react-router';
import { Gauge } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { UtilityObligationsSignal } from '../utility-obligations-signal';

interface UtilityObligationsSectionProps {
  signal: UtilityObligationsSignal;
  isLoading: boolean;
  /** When true, do not paint a successful empty queue for a failed read. */
  isError?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

/**
 * P3 — Today: utility obligations queue.
 *
 * Shows the operational obligation (late or imminently due utility claims)
 * so the office owner sees it on Today without opening the Services workspace.
 * Rows are a bounded presentation slice; the badge uses the complete-set count
 * from the shared utilities derivation.
 */
export function UtilityObligationsSection({ signal, isLoading, isError = false, settings }: UtilityObligationsSectionProps) {
  const { money } = settings;
  const { summary, rows, actionableCount } = signal;

  return (
    <section className="dashboard-queue-card" aria-labelledby="utility-obligations-title">
      <div className="dashboard-queue-card__header">
        <div className="dashboard-queue-card__title-group">
          <span
            className={cn(
              'dashboard-queue-card__icon',
              summary.overdueCount > 0 ? 'dashboard-queue-card__icon--danger' : 'dashboard-queue-card__icon--warning',
            )}
            aria-hidden="true"
          >
            <Gauge className="size-4" />
          </span>
          <div>
            <h3 id="utility-obligations-title" className="dashboard-queue-card__title">التزامات المرافق</h3>
            <p className="dashboard-queue-card__meta">
              {summary.overdueCount > 0 ? `متأخر منها ${money(summary.overdueAmount)}` : 'مطالبات مرافق تقترب من الاستحقاق'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && !isError ? (
            <StatusBadge tone={summary.overdueCount > 0 ? 'danger' : actionableCount > 0 ? 'warning' : 'success'}>
              {actionableCount}
            </StatusBadge>
          ) : null}
          <Link to="/utilities" data-dashboard-section-action className="dashboard-section-link">عرض الكل</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="dashboard-queue-list" aria-label="جارٍ تحميل التزامات المرافق">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : null}

      {!isLoading && isError ? (
        <div className="dashboard-queue-empty" role="alert">
          <p className="font-semibold">تعذر تحميل التزامات المرافق</p>
          <p>افتح صفحة المرافق للتحقق. لن نعرض قائمة فارغة عند فشل التحميل.</p>
        </div>
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <div className="dashboard-queue-empty" role="status">
          <p className="font-semibold">لا توجد مطالبات مرافق تحتاج متابعة</p>
          <p>ستظهر هنا الفواتير المتأخرة أو التي تستحق خلال أيام.</p>
        </div>
      ) : null}

      {!isLoading && !isError && rows.length > 0 ? (
        <ul className="dashboard-queue-list" role="list">
          {rows.map((row) => {
            const isLate = row.urgency === 'overdue';
            return (
              <li key={row.billId} role="listitem" className="min-w-0">
                <Link
                  to="/utilities"
                  className={cn('dashboard-queue-row', isLate ? 'dashboard-queue-row--danger' : 'dashboard-queue-row--warning')}
                  data-dashboard-queue-link
                  aria-label={`${row.title} — ${row.meta} — ${money(row.remainingAmount)}`}
                >
                  <span className="dashboard-queue-row__main">
                    <span className="dashboard-queue-row__title">{row.title}</span>
                    <span className="dashboard-queue-row__meta">{row.meta}</span>
                  </span>
                  <span className="dashboard-queue-row__side">
                    <StatusBadge tone={isLate ? 'danger' : 'warning'}>
                      {isLate ? `${row.daysOverdue} يوم` : 'قريباً'}
                    </StatusBadge>
                    <span className="dashboard-queue-row__amount" dir="ltr">{money(row.remainingAmount)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
