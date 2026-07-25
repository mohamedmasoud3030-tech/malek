import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useFinancialPeriodSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { cn } from '@/lib/utils';

export function ReportsHero({ summary, today, isLoading }: Readonly<{
  summary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  today: string;
  isLoading: boolean;
}>) {
  const invoiced = summary?.invoiced ?? 0;
  const paid = summary?.paid ?? 0;
  const outstanding = summary?.outstanding ?? 0;
  const expenses = summary?.expenses ?? 0;
  const netCash = summary?.netCash ?? 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
              <BarChart3 className="size-4 text-primary" />
              مركز التقارير والكشوف
            </p>
            <h1 className="mt-0.5 text-xl font-bold sm:text-2xl">مركز التقارير</h1>
          </div>
          <StatusBadge tone="info">{today}</StatusBadge>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div>
            {isLoading ? (
              <Skeleton className="h-10 w-32 bg-muted" />
            ) : (
              <p className="text-3xl font-bold tabular-nums sm:text-4xl" dir="ltr">{formatMoney(paid)}</p>
            )}
            <p className="text-xs font-semibold text-muted-foreground">المحصل للفترة المحددة</p>
          </div>
          <div aria-hidden="true" className="mb-1 ms-4 h-10 w-px bg-border" />
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 bg-muted" />
            ) : (
              <p className="text-lg font-bold" dir="ltr">{formatMoney(outstanding)}</p>
            )}
            <p className="text-xs font-semibold text-muted-foreground">الرصيد المستحق</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1.5">قراءة فقط</span>
          <span className={cn('rounded-full px-3 py-1.5', netCash >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
            صافي الحركة {formatMoney(netCash)}
          </span>
          <span className="rounded-full bg-muted px-3 py-1.5">
            فواتير {formatMoney(invoiced)} · مصروفات {formatMoney(expenses)}
          </span>
        </div>
      </div>
    </div>
  );
}
