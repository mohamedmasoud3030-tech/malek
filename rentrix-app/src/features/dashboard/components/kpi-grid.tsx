import { Link } from '@tanstack/react-router';
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

/**
 * KPI summary cards. Each KPI is a decision destination, so the whole card is
 * a real link (data-dashboard-kpi-link) into the owning surface — never a
 * click-handler div — preserving keyboard navigation and focus visibility.
 */
export function KpiGrid({ snapshot, isLoading, settings }: KpiGridProps) {
  const money = (value: number | null | undefined) => formatCompanyMoney(settings, value);
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
      to: '/financials' as const,
      destinationLabel: 'المركز المالي',
    },
    {
      label: 'المصروفات',
      value: money(snapshot?.financial.expenses ?? 0),
      icon: Receipt,
      sub: `خلال الفترة الحالية`,
      trend: 'neutral' as const,
      trendValue: undefined,
      to: '/expenses' as const,
      destinationLabel: 'سجل المصروفات',
    },
    {
      label: 'صافي الدخل',
      value: money(net),
      icon: TrendingUp,
      sub: `بعد خصم المصروفات`,
      trend: net >= 0 ? ('up' as const) : ('down' as const),
      trendValue: net >= 0 ? 'موجب' : 'سالب',
      to: '/reports' as const,
      destinationLabel: 'التقارير المالية',
    },
    {
      label: 'المتأخرات',
      value: money(overdue),
      icon: AlertTriangle,
      sub: `${snapshot?.arrears.overdueInvoiceCount ?? 0} فاتورة تحتاج متابعة`,
      trend: overdue > 0 ? ('down' as const) : ('neutral' as const),
      trendValue: overdue > 0 ? 'إجراء مطلوب' : 'سليم',
      to: '/arrears' as const,
      destinationLabel: 'سجل المتأخرات',
    },
  ];

  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل مؤشرات لوحة التحكم" />;
  }

  return (
    <div data-dashboard-kpi-grid>
      <ResponsiveCardGrid className="gap-3 sm:gap-4">
        {items.map((item) => {
          const { to, destinationLabel, ...card } = item;
          return (
            <Link
              key={item.label}
              to={to}
              data-dashboard-kpi-link
              aria-label={`${item.label} — انتقل إلى ${destinationLabel}`}
            >
              <KpiCard {...card} className="h-full rounded-2xl border-border/80 bg-card/95 shadow-card hover:border-primary/25" />
            </Link>
          );
        })}
      </ResponsiveCardGrid>
    </div>
  );
}
