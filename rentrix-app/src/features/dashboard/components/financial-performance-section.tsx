import { memo } from 'react';
import { BarChart3 } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ReportBarChart } from '@/components/ui/report-bar-chart';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import {
  financialPerformanceWindowLabels,
  type FinancialPerformanceWindow,
  type MonthlyCashflowChartRow,
} from '../financial-performance';
import { DashboardSignalPanel } from './dashboard-signal-primitives';
import { cn } from '@/lib/utils';

interface FinancialPerformanceSectionProps {
  settings: CompanySettingsContract;
  window: FinancialPerformanceWindow;
  onWindowChange: (window: FinancialPerformanceWindow) => void;
  chartRows: readonly MonthlyCashflowChartRow[];
  chartIsLoading: boolean;
  chartIsError: boolean;
  onChartRetry: () => void;
}

/**
 * «أداء المكتب» — one primary monthly collections-vs-expenses chart from the
 * canonical Reports cashflow service. Occupancy, arrears and contract signals
 * stay in their own command-center sections instead of being repeated here.
 */
export const FinancialPerformanceSection = memo(function FinancialPerformanceSection({
  settings,
  window,
  onWindowChange,
  chartRows,
  chartIsLoading,
  chartIsError,
  onChartRetry,
}: FinancialPerformanceSectionProps) {
  const money = (value: number) => formatCompanyMoney(settings, value);

  const chartData = chartRows.map((row) => ({ label: row.label, collected: row.collected, expenses: row.expenses }));
  const totalCollected = chartRows.reduce((sum, row) => sum + row.collected, 0);
  const totalExpenses = chartRows.reduce((sum, row) => sum + row.expenses, 0);

  return (
    <div className="grid min-w-0" data-dashboard-financial-performance>
      <DashboardSignalPanel
        labelledBy="financial-performance-title"
        className="min-w-0 border-primary/20 bg-gradient-to-br from-primary/[0.045] via-card to-card"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3.5 py-3 sm:px-4" data-dashboard-signal-header>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-bg text-info-text ring-1 ring-info-text/10" aria-hidden="true">
              <BarChart3 className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 id="financial-performance-title" className="truncate text-[13.5px] font-extrabold leading-5 text-foreground sm:text-sm">أداء المكتب</h3>
              <p className="mt-0.5 line-clamp-1 text-[11px] font-medium leading-4 text-muted-foreground">
                المحصّل مقابل المصروفات المسجلة شهرياً
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border/55 bg-muted/65 p-0.5 shadow-sm" role="group" aria-label="فترة العرض">
            {(Object.keys(financialPerformanceWindowLabels) as FinancialPerformanceWindow[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onWindowChange(option)}
                aria-pressed={window === option}
                data-dashboard-performance-window={option}
                className={cn(
                  'min-h-9 rounded-md px-3 text-[11px] font-bold outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary/25',
                  window === option ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                )}
              >
                {financialPerformanceWindowLabels[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border/60 p-3 sm:p-4">
          {chartIsLoading ? (
            <LoadingState variant="section" label="جارٍ تحميل الأداء المالي" />
          ) : chartIsError ? (
            <ErrorState
              compact
              title="تعذر تحميل الأداء المالي"
              description="تحقق من الاتصال ثم أعد المحاولة."
              onRetry={onChartRetry}
            />
          ) : chartRows.length === 0 ? (
            <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-4 text-center" data-dashboard-performance-empty>
              <div>
                <p className="text-sm font-bold text-foreground">لا توجد حركة مالية مسجلة ضمن هذه الفترة</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  عند تسجيل تحصيلات أو مصروفات سيظهر اتجاهها الشهري هنا.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-background/40 px-1.5 py-2 sm:px-2">
                <ReportBarChart
                  data={chartData}
                  xKey="label"
                  ariaLabel={`أداء المكتب خلال ${financialPerformanceWindowLabels[window]}: المحصّل مقابل المصروفات شهرياً`}
                  series={[
                    { dataKey: 'collected', name: 'المحصّل', tone: 'primary' },
                    { dataKey: 'expenses', name: 'المصروفات', tone: 'negative' },
                  ]}
                  className="h-44 sm:h-52 lg:h-52"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-[11px] font-bold text-muted-foreground" data-dashboard-performance-summary>
                <span>إجمالي الفترة</span>
                <span className="tabular-nums text-foreground/80">مُحصّل {money(totalCollected)} · مصروفات {money(totalExpenses)}</span>
              </div>
            </>
          )}
        </div>
      </DashboardSignalPanel>
    </div>
  );
});
