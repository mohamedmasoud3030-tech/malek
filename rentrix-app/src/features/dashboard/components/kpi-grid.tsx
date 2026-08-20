import { Link } from '@tanstack/react-router';
import { HandCoins, Percent, Receipt, TrendingUp } from 'lucide-react';
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
 * Secondary decision KPIs — deliberately complements, never repeats, the
 * executive hero strip (which already surfaces تحصيل / متأخرات / إشغال /
 * عقود نشطة). These four add a different decision context: the bottom-line
 * cash position, collection efficiency, outflow, and the owner-money
 * liability the office owes.
 */
export function KpiGrid({ snapshot, isLoading, settings }: KpiGridProps) {
  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل مؤشرات لوحة التحكم" />;
  }

  const money = (value: number | null | undefined) => (
    typeof value === 'number' && Number.isFinite(value) ? formatCompanyMoney(settings, value) : 'غير متاح'
  );
  const net = snapshot?.netCash;
  const collectionRate = snapshot?.collections.collectionRate;
  const expensesTotal = snapshot?.expenses.totalAmount;
  const expensesCount = snapshot?.expenses.count;
  const ownerNetPayable = snapshot?.ownerFunds.netPayable;
  const settlementsDraft = snapshot?.ownerFunds.settlementsDraft;

  const items: DashboardKpi[] = [
    {
      label: 'صافي النقد',
      value: money(net),
      icon: TrendingUp,
      support: 'الموقف النقدي بعد خصم المصروفات ضمن الفترة الحالية',
      stateTone: (net ?? 0) >= 0 ? 'success' : 'danger',
      stateLabel: (net ?? 0) >= 0 ? 'موجب' : 'سالب',
      to: '/reports',
      destinationLabel: 'التقارير المالية',
    },
    {
      label: 'نسبة التحصيل',
      value: typeof collectionRate === 'number' && Number.isFinite(collectionRate) ? `${collectionRate}%` : 'غير متاح',
      icon: Percent,
      support: 'كفاءة تحصيل المستحقات ضمن الفترة',
      stateTone: (collectionRate ?? 0) >= 80 ? 'success' : (collectionRate ?? 0) >= 50 ? 'warning' : 'danger',
      stateLabel: (collectionRate ?? 0) >= 80 ? 'ممتاز' : (collectionRate ?? 0) >= 50 ? 'مراقبة' : 'منخفض',
      to: '/financials',
      destinationLabel: 'المركز المالي',
    },
    {
      label: 'المصروفات',
      value: money(expensesTotal),
      icon: Receipt,
      support: `${expensesCount ?? 'غير متاح'} قيود مصروفات خلال الفترة`,
      stateTone: 'neutral',
      to: '/expenses',
      destinationLabel: 'سجل المصروفات',
    },
    {
      label: 'مستحقات الملاك',
      value: money(ownerNetPayable),
      icon: HandCoins,
      support: settlementsDraft !== undefined ? `${settlementsDraft} تسوية بانتظار الاعتماد` : 'التزامات الملاك ضمن الفترة',
      stateTone: (ownerNetPayable ?? 0) > 0 ? 'warning' : 'success',
      stateLabel: (settlementsDraft ?? 0) > 0 ? 'بانتظار الاعتماد' : 'لا تعليق',
      to: '/owner-settlements',
      destinationLabel: 'تسويات الملاك',
    },
  ];

  return (
    <div data-dashboard-kpi-grid>
      {/* role="list" needs real <li> children: an <a role="listitem"> is invalid
          ARIA (axe aria-allowed-role). The <li> is the grid item; the link fills it. */}
      <ul className="dashboard-kpi-grid" role="list" aria-label="مؤشرات الأداء الأساسية">
        {items.map((item) => (
          <li key={item.label} role="listitem" className="min-w-0">
            <Link
              to={item.to}
              data-dashboard-kpi-link
              className={cn('dashboard-kpi-link')}
              aria-label={`${item.label} — انتقل إلى ${item.destinationLabel}`}
            >
              <DashboardKpiCard item={item} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
