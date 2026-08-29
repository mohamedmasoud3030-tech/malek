import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { Gauge } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { UtilityObligationsSignal } from '../utility-obligations-signal';
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

interface UtilityObligationsSectionProps {
  signal: UtilityObligationsSignal;
  isLoading: boolean;
  /** When true, do not paint a successful empty queue for a failed read. */
  isError?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

/** Operational utility obligations: late or imminently due claims. */
export const UtilityObligationsSection = memo(function UtilityObligationsSection({ signal, isLoading, isError = false, settings }: UtilityObligationsSectionProps) {
  const { money } = settings;
  const { summary, rows, actionableCount } = signal;
  const headerTone = summary.overdueCount > 0 ? 'danger' : actionableCount > 0 ? 'warning' : 'success';

  return (
    <DashboardSignalPanel labelledBy="utility-obligations-title">
      <DashboardSignalHeader
        id="utility-obligations-title"
        title="التزامات المرافق"
        meta={summary.overdueCount > 0 ? `متأخر منها ${money(summary.overdueAmount)}` : 'مطالبات تقترب من الاستحقاق'}
        icon={Gauge}
        tone={headerTone}
        trailing={(
          <>
            {!isLoading && !isError ? <StatusBadge tone={headerTone}>{actionableCount}</StatusBadge> : null}
            <Link to="/utilities" data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>
          </>
        )}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل التزامات المرافق" /> : null}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل التزامات المرافق"
          description="افتح صفحة المرافق للتحقق. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <DashboardSignalEmpty title="لا توجد مطالبات مرافق تحتاج متابعة" description="ستظهر هنا الفواتير المتأخرة أو التي تستحق خلال أيام." />
      ) : null}

      {!isLoading && !isError && rows.length > 0 ? (
        <DashboardSignalList label="التزامات المرافق">
          {rows.map((row) => {
            const isLate = row.urgency === 'overdue';
            const tone = isLate ? 'danger' : 'warning';
            return (
              <li key={row.billId} role="listitem" className="min-w-0">
                <Link
                  to="/utilities"
                  className={dashboardSignalRowClass(tone)}
                  data-dashboard-queue-link
                  aria-label={`${row.title} — ${row.meta} — ${money(row.remainingAmount)}`}
                >
                  <DashboardSignalMain title={row.title} meta={row.meta} />
                  <DashboardSignalSide>
                    <StatusBadge tone={tone}>{isLate ? `${row.daysOverdue} يوم` : 'قريباً'}</StatusBadge>
                    <span dir="ltr" className="font-extrabold text-foreground">{money(row.remainingAmount)}</span>
                  </DashboardSignalSide>
                </Link>
              </li>
            );
          })}
        </DashboardSignalList>
      ) : null}
    </DashboardSignalPanel>
  );
});
