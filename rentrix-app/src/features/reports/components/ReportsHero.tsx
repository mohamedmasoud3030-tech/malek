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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 size-40 rounded-full bg-primary/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 -right-4 size-32 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-300">
              <BarChart3 className="size-4 text-primary" />
              مركز التقارير والكشوف
            </p>
            <h1 className="mt-0.5 text-xl font-bold sm:text-2xl">مركز التقارير</h1>
          </div>
          <StatusBadge tone="blue">{today}</StatusBadge>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div>
            {isLoading ? (
              <Skeleton className="h-10 w-32 bg-white/10" />
            ) : (
              <p className="text-3xl font-bold tabular-nums sm:text-4xl" dir="ltr">{formatMoney(paid)}</p>
            )}
            <p className="text-xs font-semibold text-slate-400">المحصل للفترة المحددة</p>
          </div>
          <div aria-hidden="true" className="mb-1 ms-4 h-10 w-px bg-white/20" />
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 bg-white/10" />
            ) : (
              <p className="text-lg font-bold" dir="ltr">{formatMoney(outstanding)}</p>
            )}
            <p className="text-xs font-semibold text-slate-400">الرصيد المستحق</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
          <span className="rounded-full bg-white/10 px-3 py-1.5">قراءة فقط</span>
          <span className={cn('rounded-full px-3 py-1.5', netCash >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
            صافي الحركة {formatMoney(netCash)}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            فواتير {formatMoney(invoiced)} · مصروفات {formatMoney(expenses)}
          </span>
        </div>
      </div>
    </div>
  );
}
