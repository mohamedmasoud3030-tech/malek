import { Link } from '@tanstack/react-router';
import { HandCoins, Percent, Receipt, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { KpiCard, type KpiAccent } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface KpiGridProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

type DashboardKpi = Readonly<{
  label: string;
  value: string;
  icon: LucideIcon;
  sub: string;
  accent: KpiAccent;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  to: string;
  destinationLabel: string;
}>;

/**
 * Money and obligations KPIs. These intentionally complement the stable office
 * pulse instead of repeating collection amount, outstanding amount, occupancy,
 * or active-contract counts.
 */
export function KpiGrid({ snapshot, isLoading, settings }: KpiGridProps) {
  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل المال والالتزامات" />;
  }

  const money = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? formatCompanyMoney(settings, value) : 'غير متاح';

  const net = snapshot?.netCash;
  const collectionRate = snapshot?.collections.collectionRate;
  const expensesTotal = snapshot?.expenses.totalAmount;
  const expensesCount = snapshot?.expenses.count;
  const ownerNetPayable = snapshot?.ownerFunds.netPayable;
  const settlementsDraft = snapshot?.ownerFunds.settlementsDraft;

  const collectionRateNum = collectionRate ?? 0;
  const netNum = net ?? 0;
  const ownerPayableNum = ownerNetPayable ?? 0;
  const settlementsNum = settlementsDraft ?? 0;

  const allItems: DashboardKpi[] = [
    {
      label: 'فرق التحصيل والمصروفات',
      value: money(net),
      icon: TrendingUp,
      sub: 'التحصيل ناقص المصروفات المسجلة',
      accent: netNum >= 0 ? 'emerald' : 'rose',
      trend: netNum >= 0 ? 'up' : 'down',
      trendValue: netNum >= 0 ? 'التحصيل أعلى' : 'المصروفات أعلى',
      to: '/reports',
      destinationLabel: 'التقارير المالية',
    },
    {
      label: 'نسبة التحصيل',
      value:
        typeof collectionRate === 'number' && Number.isFinite(collectionRate)
          ? `${collectionRate}%`
          : 'غير متاح',
      icon: Percent,
      sub: 'كفاءة تحصيل المستحقات الحالية',
      accent: collectionRateNum >= 80 ? 'emerald' : collectionRateNum >= 50 ? 'amber' : 'rose',
      trend: collectionRateNum >= 80 ? 'up' : collectionRateNum >= 50 ? 'neutral' : 'down',
      trendValue: collectionRateNum >= 80 ? 'ممتاز' : collectionRateNum >= 50 ? 'مراقبة' : 'منخفض',
      to: '/financials',
      destinationLabel: 'المركز المالي',
    },
    {
      label: 'المصروفات',
      value: money(expensesTotal),
      icon: Receipt,
      sub: `${expensesCount ?? 'غير متاح'} قيود خلال الفترة`,
      accent: 'slate',
      to: '/expenses',
      destinationLabel: 'سجل المصروفات',
    },
    {
      label: 'مستحقات الملاك',
      value: money(ownerNetPayable),
      icon: HandCoins,
      sub: settlementsNum > 0 ? `${settlementsNum} تسوية بانتظار الاعتماد` : 'الالتزامات الحالية للملاك',
      accent: settlementsNum > 0 ? 'amber' : ownerPayableNum > 0 ? 'sky' : 'slate',
      trend: settlementsNum > 0 ? 'neutral' : undefined,
      trendValue: settlementsNum > 0 ? 'بانتظار الاعتماد' : ownerPayableNum > 0 ? 'مستحق' : undefined,
      to: '/owner-settlements',
      destinationLabel: 'تسويات الملاك',
    },
  ];

  const visibleItems = allItems.filter((item) => {
    if (item.label !== 'المصروفات') return true;
    const numeric = Number(String(item.value).replace(/[^\d.-]/g, ''));
    return Number.isNaN(numeric) || numeric !== 0;
  });

  if (visibleItems.length === 0) return null;

  return (
    <div data-dashboard-kpi-grid>
      <ResponsiveCardGrid desktopColumns={2} gap="md" aria-label="المال والالتزامات">
        {visibleItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            data-dashboard-kpi-link
            className="block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`${item.label} — انتقل إلى ${item.destinationLabel}`}
          >
            <KpiCard
              label={item.label}
              value={item.value}
              sub={item.sub}
              icon={item.icon}
              accent={item.accent}
              trend={item.trend}
              trendValue={item.trendValue}
              className="h-full"
            />
          </Link>
        ))}
      </ResponsiveCardGrid>
    </div>
  );
}
