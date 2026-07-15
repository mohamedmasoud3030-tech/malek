import { AlertTriangle, Receipt, TrendingUp, WalletCards } from 'lucide-react';
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
      label: 'التحصيل الشهري',
      value: money(collected),
      icon: WalletCards,
      sub: `من ${money(snapshot?.financial.rentDue ?? 0)} مستحق`,
      trend: collected > 0 ? ('up' as const) : ('neutral' as const),
      trendValue: collected > 0 ? 'محصّل' : 'لا تحصيل',
    },
    {
      label: 'المصروفات',
      value: money(snapshot?.financial.expenses ?? 0),
      icon: Receipt,
      sub: `خلال الفترة الحالية`,
      trend: 'neutral' as const,
      trendValue: undefined,
    },
    {
      label: 'صافي الدخل',
      value: money(net),
      icon: TrendingUp,
      sub: `بعد خصم المصروفات`,
      trend: net >= 0 ? ('up' as const) : ('down' as const),
      trendValue: net >= 0 ? 'موجب' : 'سالب',
    },
    {
      label: 'المتأخرات',
      value: money(overdue),
      icon: AlertTriangle,
      sub: `${snapshot?.arrears.overdueInvoiceCount ?? 0} فاتورة تحتاج متابعة`,
      trend: overdue > 0 ? ('down' as const) : ('neutral' as const),
      trendValue: overdue > 0 ? 'إجراء مطلوب' : 'سليم',
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
