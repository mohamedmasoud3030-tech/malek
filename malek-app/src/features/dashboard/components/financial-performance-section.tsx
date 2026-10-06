import { memo } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ReportBarChart } from '@/components/ui/report-bar-chart';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { ReportPanel, ReportState } from '@/components/ui/report-section-primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import {
  financialPerformanceWindowLabels,
  type FinancialPerformanceWindow,
  type MonthlyCashflowChartRow,
} from '../financial-performance';

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
      <ReportPanel
        dense
        tone="info"
        icon={BarChart3}
        title="أداء المكتب"
        titleId="financial-performance-title"
        aria-labelledby="financial-performance-title"
        description="المحصّل مقابل المصروفات المسجلة شهرياً"
        action={
          <FilterTabs
            ariaLabel="فترة العرض"
            tone="primary"
            value={window}
            onChange={onWindowChange}
            options={(Object.keys(financialPerformanceWindowLabels) as FinancialPerformanceWindow[]).map(
              (option) => ({ value: option, label: financialPerformanceWindowLabels[option] }),
            )}
          />
        }
        className="min-w-0"
      >
        <div className="p-3 sm:p-4">
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
            <div data-dashboard-performance-empty>
              <ReportState
                kind="empty"
                title="لا توجد حركة مالية مسجلة ضمن هذه الفترة"
                message="عند تسجيل تحصيلات أو مصروفات سيظهر اتجاهها الشهري هنا."
                className="min-h-24 border-border/60 bg-muted/20 sm:min-h-24"
              />
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
              <details data-dashboard-performance-data className="mt-2 border-t border-border/50">
                <summary className="group flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-1.5 text-[11px] font-bold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/25 [&::-webkit-details-marker]:hidden">
                  <span>عرض الأرقام الشهرية</span>
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <div className="mobile-scroll-x rounded-xl border border-border/60 bg-background/30">
                  <Table density="compact" aria-label="الأرقام الشهرية للمحصّل والمصروفات">
                    <caption className="sr-only">الأرقام المعروضة في مخطط أداء المكتب خلال الفترة المختارة.</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الشهر</TableHead>
                        <TableHead>المحصّل</TableHead>
                        <TableHead>المصروفات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chartRows.map((row) => (
                        <TableRow key={row.month}>
                          <TableCell className="font-bold">{row.label}</TableCell>
                          <TableCell dir="ltr">{money(row.collected)}</TableCell>
                          <TableCell dir="ltr">{money(row.expenses)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-[11px] font-bold text-muted-foreground" data-dashboard-performance-summary>
                <span>إجمالي الفترة</span>
                <span className="tabular-nums text-foreground/80">مُحصّل {money(totalCollected)} · مصروفات {money(totalExpenses)}</span>
              </div>
            </>
          )}
        </div>
      </ReportPanel>
    </div>
  );
});
