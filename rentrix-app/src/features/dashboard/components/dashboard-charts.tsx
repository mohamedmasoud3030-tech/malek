import { Link } from '@tanstack/react-router';
import { BarChart3, Building2 } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { cn } from '@/lib/utils';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface DashboardChartsProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

type BarItem = {
  label: string;
  value: number;
  tone: string;
  displayValue?: string;
};

function MetricBars({ title, description, items, formatValue, emptyLabel, to, icon: Icon }: {
  title: string;
  description: string;
  items: BarItem[];
  formatValue: (value: number) => string;
  emptyLabel: string;
  to: string;
  icon: typeof BarChart3;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <Link to={to} className="dashboard-trend-card" data-dashboard-analytics-link>
      <article>
        <div className="dashboard-trend-card__header">
          <span className="dashboard-trend-card__icon" aria-hidden="true">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="dashboard-trend-card__title">{title}</h3>
            <p className="dashboard-trend-card__description">{description}</p>
          </div>
        </div>
        <div className="dashboard-trend-card__bars">
          {max <= 0 ? (
            <p className="dashboard-trend-empty">{emptyLabel}</p>
          ) : items.map((item) => {
            const width = Math.max(6, Math.round((item.value / max) * 100));
            return (
              <div key={item.label} className="dashboard-trend-bar">
                <div className="dashboard-trend-bar__labels">
                  <span>{item.label}</span>
                  <span className="tabular-nums" dir="ltr">{item.displayValue ?? formatValue(item.value)}</span>
                </div>
                <div className="dashboard-trend-bar__track" role="progressbar" aria-label={item.label} aria-valuenow={item.value} aria-valuemax={max}>
                  <div className={cn('dashboard-trend-bar__fill transition-[width] duration-500 motion-reduce:transition-none', item.tone)} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </Link>
  );
}

export function DashboardCharts({ snapshot, isLoading, settings }: DashboardChartsProps) {
  if (isLoading) {
    return (
      <div className="dashboard-trends-grid">
        <LoadingState variant="section" label="جارٍ تحميل اتجاهات التحصيل" />
        <LoadingState variant="section" label="جارٍ تحميل اتجاهات الإشغال" />
      </div>
    );
  }

  const money = (value: number) => formatCompanyMoney(settings, value);
  const collectionItems: BarItem[] = [
    { label: 'المستحق', value: snapshot?.financial.rentDue ?? 0, tone: 'bg-info' },
    { label: 'المحصّل', value: snapshot?.financial.collectedRent ?? 0, tone: 'bg-success' },
    { label: 'المتبقي', value: snapshot?.financial.outstandingRent ?? 0, tone: 'bg-warning' },
    { label: 'المتأخر', value: snapshot?.arrears.totalOverdue ?? 0, tone: 'bg-danger' },
  ];
  const totalUnits = snapshot?.operational.units ?? 0;
  const occupancyItems: BarItem[] = [
    { label: 'إجمالي الوحدات', value: totalUnits, tone: 'bg-info' },
    { label: 'مشغولة', value: snapshot?.operational.occupiedUnits ?? 0, tone: 'bg-success' },
    { label: 'شاغرة', value: snapshot?.operational.vacantUnits ?? 0, tone: 'bg-warning' },
    {
      label: 'نسبة الإشغال',
      value: totalUnits > 0 ? (snapshot?.operational.occupancyRate ?? 0) * totalUnits / 100 : 0,
      displayValue: `${snapshot?.operational.occupancyRate ?? 0}%`,
      tone: 'bg-primary',
    },
  ];

  return (
    <div className="dashboard-trends-grid">
      <MetricBars
        title="حالة التحصيل"
        description="ملخص مباشر للفترة الحالية"
        items={collectionItems}
        formatValue={money}
        emptyLabel="لا توجد بيانات تحصيل لهذه الفترة بعد."
        to="/financials"
        icon={BarChart3}
      />
      <MetricBars
        title="حالة المحفظة"
        description="إشغال الوحدات والشواغر الآن"
        items={occupancyItems}
        formatValue={(value) => String(value)}
        emptyLabel="لا توجد وحدات مسجلة بعد."
        to="/properties"
        icon={Building2}
      />
    </div>
  );
}
