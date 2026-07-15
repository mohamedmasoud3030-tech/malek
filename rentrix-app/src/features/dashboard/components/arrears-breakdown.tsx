import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

const BUCKET_CONFIG = [
  {
    key: 'days_1_30',
    label: '١–٣٠ يوم',
    borderClass: 'border-s-warning',
    textClass: 'text-warning',
  },
  {
    key: 'days_31_60',
    label: '٣١–٦٠ يوم',
    borderClass: 'border-s-danger/60',
    textClass: 'text-danger/80',
  },
  {
    key: 'days_61_90',
    label: '٦١–٩٠ يوم',
    borderClass: 'border-s-danger',
    textClass: 'text-danger',
  },
  {
    key: 'days_90_plus',
    label: '+٩٠ يوم',
    borderClass: 'border-s-danger',
    textClass: 'text-danger font-bold',
  },
] as const;

interface ArrearsBreakdownProps {
  snapshot: DashboardSnapshot | undefined;
  settings: CompanySettingsContract;
}

export function ArrearsBreakdown({ snapshot, settings }: ArrearsBreakdownProps) {
  const totalOverdue = snapshot?.arrears.totalOverdue ?? 0;
  if (totalOverdue === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>أعمار الذمم</CardTitle>
        <p className="text-[0.8125rem] text-muted-foreground">أربع فئات ثابتة لسهولة المقارنة والمتابعة</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {BUCKET_CONFIG.map(({ key, label, borderClass, textClass }) => {
            const total = snapshot?.arrears.agedReceivables.buckets[key]?.total ?? 0;
            const count = snapshot?.arrears.agedReceivables.buckets[key]?.invoiceCount ?? 0;
            return (
              <div
                key={key}
                className={`rounded-lg border border-border/50 border-s-2 ${borderClass} bg-muted/30 p-3`}
              >
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className={`mt-2 truncate text-sm font-bold tabular-nums ${textClass}`} dir="ltr">
                  {formatCompanyMoney(settings, total)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{count} فاتورة</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
