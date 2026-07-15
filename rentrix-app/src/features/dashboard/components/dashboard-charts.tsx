import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function MetricBars({ title, description, items, formatValue, emptyLabel }: {
  title: string;
  description: string;
  items: BarItem[];
  formatValue: (value: number) => string;
  emptyLabel: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {max <= 0 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-[0.8125rem] text-muted-foreground">{emptyLabel}</p>
        ) : items.map((item) => {
          const width = Math.max(6, Math.round((item.value / max) * 100));
          return (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs font-medium">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="tabular-nums" dir="ltr">{item.displayValue ?? formatValue(item.value)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', item.tone)} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({ snapshot, isLoading, settings }: DashboardChartsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
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
    <div className="grid gap-4 lg:grid-cols-2">
      <MetricBars
        title="حالة التحصيل"
        description="مقارنة مباشرة للفترة الحالية، وليست سلسلة تاريخية"
        items={collectionItems}
        formatValue={money}
        emptyLabel="لا توجد بيانات تحصيل لهذه الفترة بعد."
      />
      <MetricBars
        title="حالة المحفظة"
        description="توزيع الوحدات المشغولة والشاغرة الآن"
        items={occupancyItems}
        formatValue={(value) => String(value)}
        emptyLabel="لا توجد وحدات مسجلة بعد."
      />
    </div>
  );
}
