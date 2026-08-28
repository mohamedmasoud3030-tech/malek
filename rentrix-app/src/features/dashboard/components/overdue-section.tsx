import { Link } from '@tanstack/react-router';
import { CreditCard } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OverdueTenantRow } from '../dashboard-utils';
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

interface OverdueSectionProps {
  rows: OverdueTenantRow[];
  /**
   * Server-authoritative overdue invoice count (arrears.overdue_count). The
   * queue rows are a bounded presentation slice, so rows.length must never be
   * shown as the operational number.
   */
  totalCount?: number;
  isLoading: boolean;
  /** When true, do not paint a successful empty queue (error is shown at page level). */
  isError?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

export function OverdueSection({ rows, totalCount, isLoading, isError = false, settings }: OverdueSectionProps) {
  const { date, money } = settings;
  const badgeCount = totalCount ?? rows.length;
  const visibleRows = rows.slice(0, 3);

  return (
    <DashboardSignalPanel labelledBy="overdue-title">
      <DashboardSignalHeader
        id="overdue-title"
        title="أعلى المتأخرات"
        meta="الأكثر تأخراً أولاً"
        icon={CreditCard}
        tone={badgeCount > 0 ? 'danger' : 'success'}
        trailing={(
          <>
            {!isLoading && !isError ? <StatusBadge tone={badgeCount > 0 ? 'danger' : 'success'}>{badgeCount}</StatusBadge> : null}
            <Link to="/arrears" data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>
          </>
        )}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل المتأخرات" /> : null}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل المتأخرات"
          description="راجع تنبيه أعلى الصفحة ثم أعد المحاولة. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}

      {!isLoading && !isError && visibleRows.length === 0 ? (
        <DashboardSignalEmpty title="لا توجد فواتير متأخرة" description="ستظهر هنا الحالات التي تحتاج متابعة تحصيل." />
      ) : null}

      {!isLoading && !isError && visibleRows.length > 0 ? (
        <DashboardSignalList label="أعلى المتأخرات">
          {visibleRows.map((row) => {
            const isHighRisk = row.daysOverdue > 90;
            return (
              <li key={row.invoiceId} role="listitem" className="min-w-0">
                <Link
                  to="/arrears"
                  className={dashboardSignalRowClass(isHighRisk ? 'danger' : 'warning')}
                  data-dashboard-queue-link
                  aria-label={`${row.tenantName} — ${row.daysOverdue} يوم تأخير — ${money(row.remainingAmount)}`}
                >
                  <DashboardSignalMain title={row.tenantName} meta={row.location} />
                  <DashboardSignalSide>
                    <StatusBadge tone={isHighRisk ? 'danger' : 'warning'}>{row.daysOverdue} يوم</StatusBadge>
                    <span dir="ltr" className="font-extrabold text-foreground">{money(row.remainingAmount)}</span>
                    <span className="hidden sm:inline">استحقاق: {date(row.dueDate)}</span>
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
