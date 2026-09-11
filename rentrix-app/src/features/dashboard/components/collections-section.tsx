import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { HandCoins, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportPanel } from '@/components/ui/report-section-primitives';
import { getAgingBucketLabel } from '@/features/financials/reports/aging-buckets';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { cn } from '@/lib/utils';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import { ProgressMeter } from './dashboard-visuals';

interface CollectionsSectionProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

// Overdue cohorts only (the `current` bucket is not arrears). Labels come from
// the canonical aging vocabulary; the dashboard owns just the severity styling.
const AGING_BUCKETS = [
  { key: 'days_1_30', textClass: 'text-warning', barClass: 'bg-warning/70' },
  { key: 'days_31_60', textClass: 'text-warning', barClass: 'bg-warning' },
  { key: 'days_61_90', textClass: 'text-danger', barClass: 'bg-danger/80' },
  { key: 'days_90_plus', textClass: 'text-danger', barClass: 'bg-danger' },
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
function collectionBarClass(rate: number): string {
  if (rate >= 80) return 'bg-success';
  if (rate >= 50) return 'bg-warning';
  return 'bg-danger';
}

export const CollectionsSection = memo(function CollectionsSection({ snapshot, isLoading, settings }: CollectionsSectionProps) {
  const money = (value: number) => formatCompanyMoney(settings, value);

  const invoiced = snapshot?.billing.invoicedAmount ?? 0;
  const collected = snapshot?.collections.collectedAmount ?? 0;
  const outstanding = snapshot?.collections.outstandingAmount ?? 0;
  const collectionRate = snapshot?.collections.collectionRate ?? 0;
  const totalOverdue = snapshot?.arrears.totalOverdue ?? 0;
  const overdueCount = snapshot?.arrears.overdueCount ?? 0;
  const hasOverdue = totalOverdue > 0 || overdueCount > 0;

  return (
    <ReportPanel
      dense
      tone={hasOverdue ? 'warning' : 'success'}
      icon={HandCoins}
      title="التحصيل والمتأخرات"
      titleId="collections-title"
      aria-labelledby="collections-title"
      description={snapshot ? collectionPeriodTitle(snapshot.period.month, snapshot.period.year) : 'الفترة الحالية'}
      action={
        <Button variant="ghost" size="sm" asChild className="min-h-11 rounded-lg px-2 text-[11px] font-bold text-primary">
          <Link to="/financials" search={{ section: "collections", view: "arrears" }} data-dashboard-section-action>
            عرض الكل
          </Link>
        </Button>
      }
      className="h-full"
      isLoading={isLoading}
      loadingLabel="جارٍ تحميل التحصيل والمتأخرات"
    >
      <div className="min-w-0 space-y-3 p-3 sm:p-4" data-dashboard-collections-summary>
        <ProgressMeter
          percent={collectionRate}
          label="نسبة التحصيل من استحقاقات الفترة"
          valueText={`${collectionRate}%`}
          barClass={collectionBarClass(collectionRate)}
        />

        <div className="grid min-w-0 grid-cols-3 divide-x divide-border/60 rounded-xl bg-muted/25 rtl:divide-x-reverse">
          {[
            { label: 'المستحق', value: money(invoiced) },
            { label: 'المحصّل', value: money(collected) },
            { label: 'المتبقي', value: money(outstanding) },
          ].map((cell) => (
            <div key={cell.label} className="min-w-0 px-1.5 py-2 text-center sm:px-2.5">
              <p className="truncate text-[11px] font-bold text-muted-foreground">{cell.label}</p>
              <p className="mt-0.5 text-[11px] font-black tabular-nums leading-4 text-foreground sm:text-sm sm:leading-6" dir="ltr">{cell.value}</p>
            </div>
          ))}
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

          {hasOverdue ? (
            (() => {
              const activeBuckets = AGING_BUCKETS
                .map((bucket) => ({ bucket, data: snapshot?.arrears.buckets[bucket.key] }))
                .filter(({ data }) => (data?.count ?? 0) > 0);
              return activeBuckets.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2" data-dashboard-arrears-aging>
                  {activeBuckets.map(({ bucket, data }) => {
                    const total = data?.total ?? 0;
                    const count = data?.count ?? 0;
                    return (
                      <div key={bucket.key} className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-muted-foreground">{getAgingBucketLabel(bucket.key)}</p>
                          <span className={cn('h-1.5 w-8 rounded-full', bucket.barClass)} aria-hidden="true" />
                        </div>
                        <p className={cn('mt-1 truncate text-sm font-black tabular-nums', bucket.textClass)} dir="ltr">
                          {money(total)}
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground">{count} فاتورة</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs font-medium text-muted-foreground">لا توجد متأخرات مصنّفة — كل الفواتير ضمن الاستحقاق.</p>
              );
            })()
          ) : (
            <p className="mt-2 text-xs font-medium text-muted-foreground">لا توجد متأخرات — كل الفواتير ضمن الاستحقاق.</p>
          )}
        </div>
      </div>
    </ReportPanel>
  );
});
