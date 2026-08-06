import { Link } from '@tanstack/react-router';
import { CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { OverdueTenantRow } from '../dashboard-utils';

interface OverdueSectionProps {
  rows: OverdueTenantRow[];
  isLoading: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

export function OverdueSection({ rows, isLoading, settings }: OverdueSectionProps) {
  const { date, money } = settings;
  return (
    <section className="dashboard-queue-card" aria-labelledby="overdue-title">
      <div className="dashboard-queue-card__header">
        <div className="dashboard-queue-card__title-group">
          <span className="dashboard-queue-card__icon dashboard-queue-card__icon--danger" aria-hidden="true">
            <CreditCard className="size-4" />
          </span>
          <div>
            <h3 id="overdue-title" className="dashboard-queue-card__title">أعلى المتأخرات</h3>
            <p className="dashboard-queue-card__meta">مرتبة حسب أيام التأخير</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading ? <StatusBadge tone={rows.length > 0 ? 'danger' : 'success'}>{rows.length}</StatusBadge> : null}
          <Link to="/arrears" data-dashboard-section-action className="dashboard-section-link">عرض الكل</Link>
        </div>
      </div>

      {isLoading && (
        <div className="dashboard-queue-list" aria-label="جارٍ تحميل المتأخرات">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="dashboard-queue-empty" role="status">
          <p className="font-semibold">لا توجد فواتير متأخرة</p>
          <p>ستظهر أعلى المتأخرات هنا عند وجود فواتير غير مسددة.</p>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="dashboard-queue-list" role="list">
          {rows.map((row) => {
            const isHighRisk = row.daysOverdue > 90;
            return (
              <Link
                key={row.invoiceId}
                to="/arrears"
                className={cn('dashboard-queue-row', isHighRisk ? 'dashboard-queue-row--danger' : 'dashboard-queue-row--warning')}
                data-dashboard-queue-link
                role="listitem"
                aria-label={`${row.tenantName} — ${row.daysOverdue} يوم تأخير — ${money(row.remainingAmount)}`}
              >
                <span className="dashboard-queue-row__main">
                  <span className="dashboard-queue-row__title">{row.tenantName}</span>
                  <span className="dashboard-queue-row__meta">{row.location}</span>
                </span>
                <span className="dashboard-queue-row__side">
                  <StatusBadge tone={isHighRisk ? 'danger' : 'warning'}>{row.daysOverdue} يوم</StatusBadge>
                  <span className="dashboard-queue-row__amount" dir="ltr">{money(row.remainingAmount)}</span>
                  <span className="dashboard-queue-row__date">استحقاق: {date(row.dueDate)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
