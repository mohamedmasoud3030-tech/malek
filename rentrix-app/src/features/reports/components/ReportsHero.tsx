import { Activity, BarChart3, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useFinancialPeriodSummaryReport } from '@/features/financials/reports/useFinancialReports';

export function ReportsHero({ summary, today, isLoading }: Readonly<{
  summary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  today: string;
  isLoading: boolean;
}>) {
  const netCash = summary?.netCash ?? 0;
  const netCashTone = netCash >= 0 ? 'success' : 'danger';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-xl shadow-slate-950/10 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-14 size-44 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 -right-8 size-40 rounded-full bg-warning/15 blur-3xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <BarChart3 className="size-4 text-primary" aria-hidden="true" />
            مركز القرار المالي والتشغيلي
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">التقارير والكشوف التنفيذية</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-300">
            قراءة موحّدة للتحصيل، المتأخرات، الإشغال، والمصروفات من مصادر Rentrix الحالية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:max-w-xs sm:justify-end">
          <StatusBadge tone="info" className="border-white/10 bg-white/10 text-slate-100 ring-white/10">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {today}
          </StatusBadge>
          {isLoading ? (
            <Skeleton className="h-7 w-32 bg-white/10" />
          ) : (
            <StatusBadge tone={netCashTone} className="border-white/10 bg-white/10 text-slate-100 ring-white/10">
              <Activity className="size-3.5" aria-hidden="true" />
              صافي الحركة {formatMoney(netCash)}
            </StatusBadge>
          )}
        </div>
      </div>
    </section>
  );
}
