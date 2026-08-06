import { Link } from '@tanstack/react-router';
import { AlertTriangle, Receipt, TrendingUp, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { cn } from '@/lib/utils';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface KpiGridProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

type KpiTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

type DashboardKpi = Readonly<{
  label: string;
  value: string;
  icon: LucideIcon;
  support: string;
  stateLabel?: string;
  stateTone: KpiTone;
  to: string;
  destinationLabel: string;
}>;

function DashboardKpiCard({ item }: { item: DashboardKpi }) {
  const Icon = item.icon;
  return (
    <article data-kpi-card data-tone={item.stateTone} className="dashboard-kpi-card">
      <div className="dashboard-kpi-card__head">
        <span className="dashboard-kpi-card__icon" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        {item.stateLabel ? <StatusBadge tone={item.stateTone === 'primary' ? 'info' : item.stateTone}>{item.stateLabel}</StatusBadge> : null}
      </div>
      <div className="dashboard-kpi-card__body">
        <p className="dashboard-kpi-card__label">{item.label}</p>
        <p className="dashboard-kpi-card__value" dir="ltr">{item.value}</p>
        <p className="dashboard-kpi-card__support">{item.support}</p>
      </div>
    </article>
  );
}

/**
 * KPI summary cards. Each KPI is a decision destination, so the whole card is
 * a real link (data-dashboard-kpi-link) into the owning surface — never a
 * click-handler div — preserving keyboard navigation and focus visibility.
 */
export function KpiGrid({ snapshot, isLoading, settings }: KpiGridProps) {
  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل مؤشرات لوحة التحكم" />;
  }

  const money = (value: number | null | undefined) => (
    typeof value === 'number' && Number.isFinite(value) ? formatCompanyMoney(settings, value) : 'غير متاح'
  );
  const overdue = snapshot?.arrears.totalOverdue;
  const net = snapshot?.financial.netPosition;
  const collected = snapshot?.financial.collectedRent;
  const rentDue = snapshot?.financial.rentDue;
  const outstanding = snapshot?.financial.outstandingRent;
  const invoiceCount = snapshot?.financial.invoicesCount;
  const paymentsCount = snapshot?.financial.paymentsCount;
  const expensesCount = snapshot?.financial.expensesCount;
  const overdueInvoiceCount = snapshot?.arrears.overdueInvoiceCount;

  const items: DashboardKpi[] = [
    {
      label: 'التحصيل الشهري',
      value: money(collected),
      icon: WalletCards,
      support: rentDue !== undefined ? `من ${money(rentDue)} مستحق · ${paymentsCount ?? 'غير متاح'} دفعات` : 'تعذر تحميل المستحقات',
      stateTone: (collected ?? 0) > 0 ? 'success' : 'neutral',
      stateLabel: (collected ?? 0) > 0 ? 'محصّل' : 'بدون تحصيل',
      to: '/financials',
      destinationLabel: 'المركز المالي',
    },
    {
      label: 'المتبقي والمتأخر',
      value: money(outstanding),
      icon: AlertTriangle,
      support: overdue !== undefined ? `${money(overdue)} متأخر · ${overdueInvoiceCount ?? 'غير متاح'} فاتورة` : 'تعذر تحميل المتأخرات',
      stateTone: (overdue ?? 0) > 0 ? 'danger' : 'success',
      stateLabel: (overdue ?? 0) > 0 ? 'إجراء مطلوب' : 'سليم',
      to: '/arrears',
      destinationLabel: 'سجل المتأخرات',
    },
    {
      label: 'صافي النقد',
      value: money(net),
      icon: TrendingUp,
      support: 'بعد خصم المصروفات ضمن الفترة الحالية',
      stateTone: (net ?? 0) >= 0 ? 'success' : 'danger',
      stateLabel: (net ?? 0) >= 0 ? 'موجب' : 'سالب',
      to: '/reports',
      destinationLabel: 'التقارير المالية',
    },
    {
      label: 'المصروفات',
      value: money(snapshot?.financial.expenses),
      icon: Receipt,
      support: `${expensesCount ?? 'غير متاح'} قيود مصروفات خلال الفترة`,
      stateTone: 'neutral',
      stateLabel: invoiceCount !== undefined ? `${invoiceCount} فواتير` : undefined,
      to: '/expenses',
      destinationLabel: 'سجل المصروفات',
    },
  ];

  return (
    <div data-dashboard-kpi-grid>
      <div className="dashboard-kpi-grid" role="list" aria-label="مؤشرات الأداء الأساسية">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            data-dashboard-kpi-link
            className={cn('dashboard-kpi-link')}
            aria-label={`${item.label} — انتقل إلى ${item.destinationLabel}`}
            role="listitem"
          >
            <DashboardKpiCard item={item} />
          </Link>
        ))}
      </div>
    </div>
  );
}
