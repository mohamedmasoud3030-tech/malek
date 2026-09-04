import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { HandCoins, Layers3 } from 'lucide-react';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { cn } from '@/lib/utils';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import { MetricStat, ProgressMeter } from './dashboard-visuals';
import {
  DashboardSignalEmpty,
  DashboardSignalHeader,
  DashboardSignalLoading,
  DashboardSignalPanel,
  dashboardSectionActionClass,
} from './dashboard-signal-primitives';

interface CollectionsSectionProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  isError?: boolean;
  settings: CompanySettingsContract;
}

const AGING_BUCKETS = [
  { key: 'days_1_30', label: '1–30 يوم', textClass: 'text-warning', barClass: 'bg-warning/70' },
  { key: 'days_31_60', label: '31–60 يوم', textClass: 'text-warning', barClass: 'bg-warning' },
  { key: 'days_61_90', label: '61–90 يوم', textClass: 'text-danger', barClass: 'bg-danger/80' },
  { key: 'days_90_plus', label: '+90 يوم', textClass: 'text-danger', barClass: 'bg-danger' },
] as const;

const monthNameFormatter = new Intl.DateTimeFormat('ar', { month: 'long' });

function collectionPeriodTitle(month: number, year: number): string {
  const parsed = new Date(Date.UTC(year, month - 1, 1));
  return `تحصيل ${monthNameFormatter.format(parsed)}`;
}

/**
 * Collection progress for the current period plus the authoritative arrears
 * aging from the snapshot. Bucket boundaries are the server's fixed cohorts —
 * they are never rebucketed in the browser.
 */
export const CollectionsSection = memo(function CollectionsSection({ snapshot, isLoading, isError = false, settings }: CollectionsSectionProps) {
  const money = (value: number) => formatCompanyMoney(settings, value);

  const invoiced = snapshot?.billing.invoicedAmount ?? 0;
  const collected = snapshot?.collections.collectedAmount ?? 0;
  const outstanding = snapshot?.collections.outstandingAmount ?? 0;
  const collectionRate = snapshot?.collections.collectionRate ?? 0;
  const totalOverdue = snapshot?.arrears.totalOverdue ?? 0;
  const overdueCount = snapshot?.arrears.overdueCount ?? 0;
  const hasOverdue = totalOverdue > 0 || overdueCount > 0;

  return (
    <DashboardSignalPanel labelledBy="collections-title" className="h-full">
      <DashboardSignalHeader
        id="collections-title"
        title="التحصيل والمتأخرات"
        meta={snapshot ? collectionPeriodTitle(snapshot.period.month, snapshot.period.year) : 'الفترة الحالية'}
        icon={HandCoins}
        tone={hasOverdue ? 'warning' : 'success'}
        trailing={<Link to="/financials" search={{ section: "collections", view: "arrears" }} data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل التحصيل والمتأخرات" /> : (
        <div className="min-w-0 space-y-3 border-t border-border/70 p-3 sm:p-4" data-dashboard-collections-summary>
          <ProgressMeter
            percent={collectionRate}
            label="نسبة التحصيل من استحقاقات الفترة"
            valueText={`${collectionRate}%`}
            barClass={collectionRate >= 80 ? 'bg-success' : collectionRate >= 50 ? 'bg-warning' : 'bg-danger'}
          />

          <div className="grid min-w-0 grid-cols-1 gap-x-4 rounded-xl bg-muted/30 px-3 py-1 sm:grid-cols-3">
            <MetricStat label="المستحق" value={money(invoiced)} />
            <MetricStat label="المحصّل" value={money(collected)} />
            <MetricStat label="المتبقي" value={money(outstanding)} />
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Layers3 className="size-3.5" aria-hidden="true" />
                أعمار المتأخرات
              </p>
              {hasOverdue ? (
                <p className="shrink-0 text-[11px] font-extrabold tabular-nums text-danger" dir="ltr" data-dashboard-arrears-total>
                  {money(totalOverdue)} · {overdueCount} فاتورة
                </p>
              ) : null}
            </div>

            {isError ? null : hasOverdue ? (
              <div className="mt-2 grid grid-cols-2 gap-2" data-dashboard-arrears-aging>
                {AGING_BUCKETS.map((bucket) => {
                  const data = snapshot?.arrears.buckets[bucket.key];
                  const total = data?.total ?? 0;
                  const count = data?.count ?? 0;
                  return (
                    <div key={bucket.key} className={cn('min-w-0 rounded-lg border border-border/60 px-2.5 py-2', count === 0 && 'opacity-70')}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-muted-foreground">{bucket.label}</p>
                        <span className={cn('h-1.5 w-8 rounded-full', count > 0 ? bucket.barClass : 'bg-muted')} aria-hidden="true" />
                      </div>
                      <p className={cn('mt-1 truncate text-sm font-black tabular-nums', total > 0 ? bucket.textClass : 'text-muted-foreground')} dir="ltr">
                        {money(total)}
                      </p>
                      <p className="text-[11px] font-medium text-muted-foreground">{count} فاتورة</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs font-medium text-muted-foreground">لا توجد متأخرات — كل الفواتير ضمن الاستحقاق.</p>
            )}
          </div>
        </div>
      )}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل المتأخرات"
          description="راجع تنبيه أعلى الصفحة ثم أعد المحاولة. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}
    </DashboardSignalPanel>
  );
});
