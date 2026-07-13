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
};

function MetricBars({
  title,
  items,
  formatValue,
  emptyLabel,
}: {
  title: string;
  items: BarItem[];
  formatValue: (value: number) => string;
  emptyLabel: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <Card className="rounded-3xl border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {max <= 0 ? (
          <p className="rounded-2xl bg-muted/50 px-3 py-4 text-center text-xs font-bold text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          items.map((item) => {
            const width = max > 0 ? Math.max(6, Math.round((item.value / max) * 100)) : 0;
            return (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="tabular-nums" dir="ltr">
                    {formatValue(item.value)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', item.tone)}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({ snapshot, isLoading, settings }: DashboardChartsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <LoadingState variant="section" label="جارٍ تحميل الرسوم" />
        <LoadingState variant="section" label="جارٍ تحميل الرسوم" />
      </div>
    );
  }

  const money = (value: number) => formatCompanyMoney(settings, value);
  const occupancy = snapshot?.operational.occupancyRate ?? 0;
  const vacant = snapshot?.operational.vacantUnits ?? 0;
  const occupied = snapshot?.operational.occupiedUnits ?? 0;

  const revenueItems: BarItem[] = [
    {
      label: 'المستحق',
      value: snapshot?.financial.rentDue ?? 0,
      tone: 'bg-sky-500',
    },
    {
      label: 'المحصّل',
      value: snapshot?.financial.collectedRent ?? 0,
      tone: 'bg-emerald-500',
    },
    {
      label: 'المتبقي',
      value: snapshot?.financial.outstandingRent ?? 0,
      tone: 'bg-amber-500',
    },
    {
      label: 'صافي الدخل',
      value: Math.max(0, snapshot?.financial.netPosition ?? 0),
      tone: 'bg-primary',
    },
  ];

  const occupancyItems: BarItem[] = [
    { label: 'مشغولة', value: occupied, tone: 'bg-emerald-500' },
    { label: 'شاغرة', value: vacant, tone: 'bg-amber-500' },
    { label: 'نسبة الإشغال %', value: occupancy, tone: 'bg-sky-500' },
  ];

  const collectionItems: BarItem[] = [
    {
      label: 'محصّل هذا الشهر',
      value: snapshot?.financial.collectedRent ?? 0,
      tone: 'bg-emerald-500',
    },
    {
      label: 'متأخرات قائمة',
      value: snapshot?.arrears.totalOverdue ?? 0,
      tone: 'bg-rose-500',
    },
    {
      label: 'أكثر من 90 يوماً',
      value: snapshot?.arrears.over90Amount ?? 0,
      tone: 'bg-rose-700',
    },
  ];

  const expenseItems: BarItem[] = [
    {
      label: 'المصروفات',
      value: snapshot?.financial.expenses ?? 0,
      tone: 'bg-amber-500',
    },
    {
      label: 'المحصّل',
      value: snapshot?.financial.collectedRent ?? 0,
      tone: 'bg-emerald-500',
    },
    {
      label: 'صافي بعد المصروف',
      value: Math.max(0, snapshot?.financial.netPosition ?? 0),
      tone: 'bg-primary',
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MetricBars
        title="اتجاه الإيرادات (الشهر الحالي)"
        items={revenueItems}
        formatValue={money}
        emptyLabel="لا توجد بيانات إيرادات لهذا الشهر بعد."
      />
      <MetricBars
        title="الإشغال"
        items={occupancyItems}
        formatValue={(value) => (value <= 100 && occupancyItems.some((i) => i.label.includes('%') && i.value === value) ? `${value}%` : String(value))}
        emptyLabel="لا توجد وحدات مسجلة بعد."
      />
      <MetricBars
        title="التحصيل والمتأخرات"
        items={collectionItems}
        formatValue={money}
        emptyLabel="لا توجد بيانات تحصيل بعد."
      />
      <MetricBars
        title="المصروفات مقابل التحصيل"
        items={expenseItems}
        formatValue={money}
        emptyLabel="لا توجد مصروفات أو تحصيلات بعد."
      />
    </div>
  );
}
