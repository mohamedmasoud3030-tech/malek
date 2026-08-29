import { Link } from '@tanstack/react-router';
import { CheckCircle2, Landmark, Scale } from 'lucide-react';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import {
  DashboardSignalEmpty,
  DashboardSignalHeader,
  DashboardSignalList,
  DashboardSignalMain,
  DashboardSignalPanel,
  DashboardSignalSide,
  dashboardSignalRowClass,
} from './dashboard-signal-primitives';

interface FinanceExceptionsSectionProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
}

/**
 * Financial hygiene exceptions that sit outside the daily money flow but
 * still need a decision: unmatched bank lines and settlements that nobody
 * moved. Both counts are server snapshot KPIs.
 */
export function FinanceExceptionsSection({ snapshot, isLoading }: FinanceExceptionsSectionProps) {
  const unmatched = snapshot?.exceptions.unmatchedBankLines ?? 0;
  const pendingSettlements = snapshot?.exceptions.pendingSettlements ?? 0;
  const hasExceptions = unmatched > 0 || pendingSettlements > 0;

  return (
    <DashboardSignalPanel labelledBy="finance-exceptions-title" className="h-full">
      <DashboardSignalHeader
        id="finance-exceptions-title"
        title="استثناءات مالية"
        meta={hasExceptions ? 'تحتاج مراجعة لإقفال نظيف' : 'لا توجد استثناءات مفتوحة'}
        icon={Scale}
        tone={hasExceptions ? 'warning' : 'success'}
      />

      {isLoading ? null : !hasExceptions ? (
        <DashboardSignalEmpty title="السجلات المالية نظيفة" description="لا حركات بنكية معلقة ولا تسويات متوقفة." />
      ) : (
        <DashboardSignalList label="الاستثناءات المالية">
          {unmatched > 0 ? (
            <li role="listitem" className="min-w-0">
              <Link
                to="/bank-reconciliation"
                className={dashboardSignalRowClass('warning')}
                data-dashboard-queue-link
                aria-label={`${unmatched} حركة بنكية غير مطابقة — انتقل إلى مطابقة البنك`}
              >
                <DashboardSignalMain title="حركات بنكية غير مطابقة" meta="بنود كشف تحتاج مطابقة" />
                <DashboardSignalSide>
                  <span className="flex items-center gap-1.5 text-sm font-black tabular-nums text-warning">
                    <Landmark className="size-3.5" aria-hidden="true" />
                    {unmatched}
                  </span>
                </DashboardSignalSide>
              </Link>
            </li>
          ) : null}
          {pendingSettlements > 0 ? (
            <li role="listitem" className="min-w-0">
              <Link
                to="/owner-settlements"
                className={dashboardSignalRowClass('warning')}
                data-dashboard-queue-link
                aria-label={`${pendingSettlements} تسوية تنتظر الإجراء — انتقل إلى تسويات الملاك`}
              >
                <DashboardSignalMain title="تسويات ملاك تنتظر الإجراء" meta="اعتماد أو صرف متوقف" />
                <DashboardSignalSide>
                  <span className="text-sm font-black tabular-nums text-warning">{pendingSettlements}</span>
                </DashboardSignalSide>
              </Link>
            </li>
          ) : null}
        </DashboardSignalList>
      )}

      {!isLoading && !hasExceptions ? (
        <div className="flex items-center gap-2 border-t border-border/70 px-3 py-2 text-[11px] font-bold text-success sm:px-4">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          حركة المال مقفلة حتى اليوم
        </div>
      ) : null}
    </DashboardSignalPanel>
  );
}
