import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertOctagon, Building2, HandCoins, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import type { DailyCollectionSeries } from '../daily-collection-series';
import { MiniBarsCompare, RadialMetric, Sparkline } from './dashboard-visuals';

interface OfficePulseProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
  /** Authoritative daily collection series for the current month (optional sparkline). */
  dailySeries?: DailyCollectionSeries;
  dailySeriesLoading?: boolean;
}

/**
 * Office Pulse — the four executive surfaces above the fold:
 * collections, occupancy, arrears and the office cash movement.
 *
 * All numbers are the server snapshot KPIs rendered as-is. Tenant/owner money
 * is never presented as office revenue: the cash-pulse surface stays
 * explicitly labelled «collections minus recorded expenses».
 */
export const OfficePulse = memo(function OfficePulse({ snapshot, isLoading, settings, dailySeries, dailySeriesLoading = false }: OfficePulseProps) {
  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل نبض المكتب" />;
  }

  const money = (value: number) => formatCompanyMoney(settings, value);

  const collected = snapshot?.collections.collectedAmount ?? 0;
  const invoiced = snapshot?.billing.invoicedAmount ?? 0;
  const collectionRate = snapshot?.collections.collectionRate ?? 0;
  const expenses = snapshot?.expenses.totalAmount ?? 0;
  const netCash = snapshot?.netCash ?? 0;

  const occupancyRate = snapshot?.occupancy.occupancyRate ?? 0;
  const occupiedUnits = snapshot?.occupancy.occupiedUnits ?? 0;
  const vacantUnits = snapshot?.occupancy.vacantUnits ?? 0;

  const totalOverdue = snapshot?.arrears.totalOverdue ?? 0;
  const overdueCount = snapshot?.arrears.overdueCount ?? 0;
  const over90Count = snapshot?.arrears.over90Count ?? 0;
  const averageDaysOverdue = snapshot?.arrears.averageDaysOverdue ?? 0;

  const sparkValues = dailySeries?.rows.map((row) => row.total) ?? [];
  const showSparkline = !dailySeriesLoading && sparkValues.length >= 2;
  const pulseCardClass = 'h-full border-border/55 bg-card/95 shadow-sm';
  const pulseLinkClass = 'group block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

  return (
    <div
      data-dashboard-office-pulse
      className="relative overflow-hidden rounded-2xl border border-border/65 bg-card p-1.5 sm:p-2"
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" aria-hidden="true" />
      <ResponsiveCardGrid gap="sm" aria-label="نبض المكتب" desktopColumns={4}>
        <Link
          to="/financials"
          data-dashboard-kpi-link
          className={pulseLinkClass}
          aria-label="التحصيل هذا الشهر — انتقل إلى المركز المالي"
        >
          <KpiCard
            label="التحصيل هذا الشهر"
            value={money(collected)}
            sub={`من ${money(invoiced)} مستحقات · نسبة التحصيل ${collectionRate}%`}
            icon={HandCoins}
            accent={collectionRate >= 80 ? 'emerald' : collectionRate >= 50 ? 'amber' : 'rose'}
            compact
            className={pulseCardClass}
            visual={showSparkline ? (
              <Sparkline values={sparkValues} label="حركة التحصيل اليومي خلال الشهر" />
            ) : undefined}
          />
        </Link>

        <Link
          to="/properties" search={{ section: "units" }}
          data-dashboard-kpi-link
          className={pulseLinkClass}
          aria-label={`نسبة الإشغال ${occupancyRate}% — انتقل إلى سجل الوحدات`}
        >
          <KpiCard
            label="نسبة الإشغال"
            value={`${occupancyRate}%`}
            sub={`${occupiedUnits} مشغولة · ${vacantUnits} شاغرة`}
            icon={Building2}
            accent={occupancyRate >= 90 ? 'emerald' : occupancyRate >= 75 ? 'amber' : 'rose'}
            compact
            className={pulseCardClass}
            visual={(
              <RadialMetric
                percent={occupancyRate}
                label={`نسبة الإشغال ${occupancyRate}%`}
                size={64}
                fillClass={occupancyRate >= 90 ? 'text-success' : occupancyRate >= 75 ? 'text-warning' : 'text-danger'}
              />
            )}
          />
        </Link>

        <Link
          to="/financials" search={{ section: "collections", view: "arrears" }}
          data-dashboard-kpi-link
          className={pulseLinkClass}
          aria-label={`المتأخرات ${money(totalOverdue)} — انتقل إلى المتأخرات`}
        >
          <KpiCard
            label="المتأخرات"
            value={money(totalOverdue)}
            sub={
              overdueCount > 0
                ? `${overdueCount} فاتورة متأخرة · متوسط ${averageDaysOverdue} يوم${over90Count > 0 ? ` · منها ${over90Count} تجاوزت 90 يوماً` : ''}`
                : 'لا توجد متأخرات مسجلة'
            }
            icon={AlertOctagon}
            accent={totalOverdue === 0 ? 'emerald' : over90Count > 0 ? 'rose' : 'amber'}
            compact
            className={pulseCardClass}
          />
        </Link>

        <Link
          to="/reports"
          data-dashboard-kpi-link
          className={pulseLinkClass}
          aria-label="نبض سيولة المكتب — انتقل إلى التقارير"
        >
          <KpiCard
            label="نبض سيولة المكتب"
            value={money(netCash)}
            sub="التحصيل ناقص المصروفات المسجلة"
            icon={TrendingUp}
            accent={netCash >= 0 ? 'emerald' : 'rose'}
            compact
            className={pulseCardClass}
            visual={(
              <MiniBarsCompare
                items={[
                  { label: 'المحصّل', value: collected, displayValue: money(collected), barClass: 'bg-success' },
                  { label: 'المصروفات', value: expenses, displayValue: money(expenses), barClass: 'bg-danger/80' },
                ]}
              />
            )}
          />
        </Link>
      </ResponsiveCardGrid>
    </div>
  );
});
