import {
  AlertTriangle,
  Building2,
  DoorOpen,
  Home,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboardSnapshot';

interface KpiGridProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

export function KpiGrid({ snapshot, isLoading, settings }: KpiGridProps) {
  const money = (v: number | null | undefined) => formatCompanyMoney(settings, v);
  const occupancy = snapshot?.operational.occupancyRate ?? 0;
  const overdue = snapshot?.arrears.totalOverdue ?? 0;
  const net = snapshot?.financial.netPosition ?? 0;
  const expenses = snapshot?.financial.expenses ?? 0;
  const collected = snapshot?.financial.collectedRent ?? 0;

  const items = [
    {
      label: 'إجمالي العقارات',
      value: snapshot?.operational.properties ?? 0,
      icon: Building2,
      accent: 'sky' as const,
      sub: 'أصول مسجلة في المحفظة',
    },
    {
      label: 'إجمالي الوحدات',
      value: snapshot?.operational.units ?? 0,
      icon: DoorOpen,
      accent: 'violet' as const,
      sub: `${snapshot?.operational.occupiedUnits ?? 0} مشغولة · ${snapshot?.operational.vacantUnits ?? 0} شاغرة`,
    },
    {
      label: 'نسبة الإشغال',
      value: `${occupancy}%`,
      icon: Home,
      accent: occupancy >= 80 ? ('emerald' as const) : occupancy >= 50 ? ('amber' as const) : ('rose' as const),
      sub: `${snapshot?.operational.activeContracts ?? 0} عقد نشط`,
      trend: occupancy >= 80 ? ('up' as const) : occupancy < 50 ? ('down' as const) : ('neutral' as const),
      trendValue: `${occupancy}%`,
    },
    {
      label: 'التحصيل الشهري',
      value: money(collected),
      icon: WalletCards,
      accent: 'emerald' as const,
      sub: `من ${money(snapshot?.financial.rentDue ?? 0)} مستحق`,
      trend: collected > 0 ? ('up' as const) : ('neutral' as const),
      trendValue: collected > 0 ? 'محصّل' : '—',
    },
    {
      label: 'المتأخرات',
      value: money(overdue),
      icon: AlertTriangle,
      accent: overdue > 0 ? ('rose' as const) : ('emerald' as const),
      sub: `${snapshot?.arrears.overdueInvoiceCount ?? 0} فاتورة متأخرة`,
      trend: overdue > 0 ? ('down' as const) : ('neutral' as const),
      trendValue: overdue > 0 ? 'يتطلب متابعة' : 'سليم',
    },
    {
      label: 'المصروفات',
      value: money(expenses),
      icon: TrendingDown,
      accent: 'amber' as const,
      sub: `${snapshot?.financial.expensesCount ?? 0} عملية`,
    },
    {
      label: 'صافي الدخل',
      value: money(net),
      icon: TrendingUp,
      accent: net >= 0 ? ('emerald' as const) : ('rose' as const),
      sub: 'المحصّل بعد المصروفات',
      trend: net >= 0 ? ('up' as const) : ('down' as const),
      trendValue: net >= 0 ? 'موجب' : 'سالب',
    },
  ];

  if (isLoading) {
    return <LoadingState variant="cards" rows={7} label="جارٍ تحميل مؤشرات لوحة التحكم" />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}
