import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

const BUCKET_ORDER = ['days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'] as const;
const BUCKET_LABELS: Record<typeof BUCKET_ORDER[number], string> = {
  days_1_30: '1–30 يوم',
  days_31_60: '31–60 يوم',
  days_61_90: '61–90 يوم',
  days_90_plus: 'أكثر من 90 يوم',
};

interface ArrearsBreakdownProps {
  snapshot: DashboardSnapshot | undefined;
  settings: CompanySettingsContract;
}

export function ArrearsBreakdown({ snapshot, settings }: ArrearsBreakdownProps) {
  const totalOverdue = snapshot?.arrears.totalOverdue ?? 0;
  if (totalOverdue === 0) return null;

  const money = (v: number) => formatCompanyMoney(settings, v);

  const buckets = BUCKET_ORDER.map((key) => ({
    label: BUCKET_LABELS[key],
    total: snapshot?.arrears.agedReceivables.buckets[key]?.total ?? 0,
    count: snapshot?.arrears.agedReceivables.buckets[key]?.invoiceCount ?? 0,
  }));

  return (
    <Card className="rounded-3xl border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">أعمار الذمم</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center justify-between rounded-2xl bg-muted/60 px-3.5 py-3">
            <span className="text-xs font-bold text-muted-foreground">{b.label}</span>
            <div className="flex items-center gap-3 text-xs font-black">
              <span className="text-muted-foreground">{b.count} فاتورة</span>
              <span dir="ltr">{money(b.total)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
