import { AlertTriangle, Home, TrendingUp, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { LoadingState } from '@/components/ui/loading-state';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface KpiGridProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

export function KpiGrid({ snapshot, isLoading, settings }: KpiGridProps) {
  const money = (value: number | null | undefined) => formatCompanyMoney(settings, value);
  const occupancy = snapshot?.operational.occupancyRate ?? 0;
  const overdue = snapshot?.arrears.totalOverdue ?? 0;
  const net = snapshot?.financial.netPosition ?? 0;
  const collected = snapshot?.financial.collectedRent ?? 0;

  const items = [
    {
      label: 'نسبة الإشغال',
      value: `${occupancy}%`,
      icon: Home,
      accent: occupancy >= 80 ? ('emerald' as const) : occupancy >= 50 ? ('amber' as const) : ('rose' as const),
      sub: `${snapshot?.operational.occupiedUnits ?? 0} مشغولة من ${snapshot?.operational.units ?? 0} وحدة`,
      trend: occupancy >= 80 ? ('up' as const) : occupancy < 50 ? ('down' as const) : ('neutral' as const),
      trendValue: occupancy >= 80 ? 'مستقر' : 'راجع الشواغر',
    },
    {
      label: 'التحصيل الشهري',
      value: money(collected),
      icon: WalletCards,
      accent: 'emerald' as const,
      sub: `من ${money(snapshot?.financial.rentDue ?? 0)} مستحق`,
      trend: collected > 0 ? ('up' as const) : ('neutral' as const),
      trendValue: collected > 0 ? 'محصّل' : 'لا تحصيل',
    },
    {
      label: 'المتأخرات',
      value: money(overdue),
      icon: AlertTriangle,
      accent: overdue > 0 ? ('rose' as const) : ('emerald' as const),
      sub: `${snapshot?.arrears.overdueInvoiceCount ?? 0} فاتورة تحتاج متابعة`,
      trend: overdue > 0 ? ('down' as const) : ('neutral' as const),
      trendValue: overdue > 0 ? 'إجراء مطلوب' : 'سليم',
    },
    {
      label: 'صافي الدخل',
      value: money(net),
      icon: TrendingUp,
      accent: net >= 0 ? ('emerald' as const) : ('rose' as const),
      sub: `بعد ${money(snapshot?.financial.expenses ?? 0)} مصروفات`,
      trend: net >= 0 ? ('up' as const) : ('down' as const),
      trendValue: net >= 0 ? 'موجب' : 'سالب',
    },
  ];

  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل مؤشرات لوحة التحكم" />;
  }

  return (
    <div data-dashboard-kpi-grid>
      <ResponsiveCardGrid>
        {items.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </ResponsiveCardGrid>
    </div>
  );
}
