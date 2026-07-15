import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

const BUCKET_ORDER = ['days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'] as const;
const BUCKET_LABELS: Record<(typeof BUCKET_ORDER)[number], string> = {
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

  const buckets = BUCKET_ORDER.map((key) => ({
    label: BUCKET_LABELS[key],
    total: snapshot?.arrears.agedReceivables.buckets[key]?.total ?? 0,
    count: snapshot?.arrears.agedReceivables.buckets[key]?.invoiceCount ?? 0,
  }));

  return (
    <Card className="rounded-3xl border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">أعمار الذمم</CardTitle>
        <p className="text-xs font-bold text-muted-foreground">أربع فئات ثابتة لسهولة المقارنة والمتابعة</p>
      </CardHeader>
      <CardContent>
        <ResponsiveCardGrid gap="sm">
          {buckets.map((bucket) => (
            <div key={bucket.label} className="rounded-2xl border border-border/50 bg-muted/45 p-3">
              <p className="text-xs font-bold text-muted-foreground">{bucket.label}</p>
              <p className="mt-2 truncate text-sm font-black" dir="ltr">{formatCompanyMoney(settings, bucket.total)}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{bucket.count} فاتورة</p>
            </div>
          ))}
        </ResponsiveCardGrid>
      </CardContent>
    </Card>
  );
}
