import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertOctagon, Building2, HandCoins, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface OfficePulseProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

/**
 * Office Pulse — the four executive KPIs in one unified strip.
 *
 * The strip stays deliberately stat-free: every visualisation (the occupancy
 * ring, the collections-vs-expenses comparison) lives once, in the detail
 * section that owns that question below. Here each tile is one headline
 * number, one label, one concise context line — scannable in seconds.
 * All numbers are the server snapshot KPIs rendered as-is. Tenant/owner money
 * is never presented as office revenue: the cash tile stays explicitly
 * labelled «collections minus recorded expenses».
 */
export const OfficePulse = memo(function OfficePulse({
  snapshot,
  isLoading,
  settings,
}: OfficePulseProps) {
  if (isLoading) {
    return (
      <LoadingState variant="cards" rows={4} label="جارٍ تحميل نبض المكتب" />
    );
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

  const pulseLinkClass =
    'group block min-w-0 rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div
      data-dashboard-office-pulse
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card"
    >
      <ResponsiveCardGrid gap="sm" aria-label="نبض المكتب" desktopColumns={4} className="dashboard-pulse-grid">
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
            accent={
              collectionRate >= 80
                ? 'emerald'
                : collectionRate >= 50
                  ? 'amber'
                  : 'rose'
            }
            compact
            className="dashboard-pulse-card"
          />
        </Link>

        <Link
          to="/properties"
          search={{ section: 'units' }}
          data-dashboard-kpi-link
          className={pulseLinkClass}
          aria-label={`نسبة الإشغال ${occupancyRate}% — انتقل إلى سجل الوحدات`}
        >
          <KpiCard
            label="نسبة الإشغال"
            value={`${occupancyRate}%`}
            sub={`${occupiedUnits} مشغولة · ${vacantUnits} شاغرة`}
            icon={Building2}
            accent={
              occupancyRate >= 90
                ? 'emerald'
                : occupancyRate >= 75
                  ? 'amber'
                  : 'rose'
            }
            compact
            className="dashboard-pulse-card"
          />
        </Link>

        <Link
          to="/financials"
          search={{ section: 'collections', view: 'arrears' }}
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
            accent={
              totalOverdue === 0
                ? 'emerald'
                : over90Count > 0
                  ? 'rose'
                  : 'amber'
            }
            compact
            className="dashboard-pulse-card"
          />
        </Link>

        <Link
          to="/reports/$reportId"
          params={{ reportId: 'portfolio-property-performance' }}
          search={{ view: 'office' }}
          data-dashboard-kpi-link
          className={pulseLinkClass}
          aria-label="نبض سيولة المكتب — انتقل إلى التقارير"
        >
          <KpiCard
            label="نبض سيولة المكتب"
            value={money(netCash)}
            sub={`محصّل ${money(collected)} ناقص مصروفات ${money(expenses)}`}
            icon={TrendingUp}
            accent={netCash >= 0 ? 'emerald' : 'rose'}
            compact
            className="dashboard-pulse-card"
          />
        </Link>
      </ResponsiveCardGrid>
    </div>
  );
});
