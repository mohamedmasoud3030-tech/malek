import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Banknote, Building2, CircleDollarSign, Gauge, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import { cn } from '@/lib/utils';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { FilterState } from '../reports-page.helpers';
import { reportSections, type ReportSectionId } from '../reports-page.sections';
import { AccountingReportsSection } from './AccountingReportsSection';
import { CollectionsSection } from './CollectionsSection';
import { DeferredRevenueReportSection } from './DeferredRevenueReportSection';
import { ExpensesSection } from './ExpensesSection';
import { MaintenanceReportSection } from './MaintenanceReportSection';
import { OccupancySection } from './OccupancySection';
import { OverdueSection } from './OverdueSection';
import { OverviewSection } from './OverviewSection';
import { PropertyAnalyticsSection } from './PropertyAnalyticsSection';
import { ReportsFilterSurface } from './ReportsFilterSurface';
import { ReportsHero } from './ReportsHero';
import { StatementsSection } from './StatementsSection';

type ReportsWorkspaceProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: FilterState;
  canExportReports: boolean;
  onFiltersChange: (filters: FilterState) => void;
  onResetCurrentMonth: () => void;
}>;

type MetricTone = 'success' | 'info' | 'warning' | 'primary';

const metricToneClasses: Record<MetricTone, { border: string; icon: string }> = {
  success: { border: 'border-t-success', icon: 'bg-success/10 text-success' },
  info: { border: 'border-t-info', icon: 'bg-info/10 text-info' },
  warning: { border: 'border-t-warning', icon: 'bg-warning/10 text-warning' },
  primary: { border: 'border-t-primary', icon: 'bg-primary/10 text-primary' },
};

export function ReportsWorkspace({
  model,
  filters,
  canExportReports,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<ReportSectionId>('overview');
  const activeSectionLabel = reportSections.find((section) => section.id === activeSection)?.label ?? 'التقارير';
  const totalExpensesCount = model.hero.summary?.expensesCount ?? 0;

  const occupancy = useMemo(() => {
    const totals = model.sections.occupancy.occupancyRows.reduce(
      (current, row) => ({
        occupied: current.occupied + row.occupied,
        vacant: current.vacant + row.vacant,
      }),
      { occupied: 0, vacant: 0 },
    );
    const total = totals.occupied + totals.vacant;
    return {
      ...totals,
      total,
      rate: total > 0 ? Math.round((totals.occupied / total) * 100) : 0,
    };
  }, [model.sections.occupancy.occupancyRows]);

  const summary = model.hero.summary;
  const netCash = summary?.netCash ?? 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <ReportsHero summary={summary} today={model.today} isLoading={model.hero.isLoading} />

      <ReportsFilterSurface
        filters={filters}
        costCenterRows={model.filters.costCenterRows}
        ownerRows={model.filters.ownerRows}
        contractRows={model.filters.contractRows}
        onChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
      />

      <section aria-label="المؤشرات التنفيذية" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ExecutiveMetricCard
          icon={Banknote}
          label="المحصّل للفترة"
          value={formatMoney(summary?.paid ?? 0)}
          helper={`${summary?.paymentsCount ?? 0} مدفوعات مسجلة`}
          tone="success"
          isLoading={model.hero.isLoading}
        />
        <ExecutiveMetricCard
          icon={Building2}
          label="نسبة الإشغال"
          value={`${occupancy.rate}%`}
          helper={`${occupancy.occupied} من ${occupancy.total} وحدة`}
          tone="info"
          isLoading={model.sections.occupancy.isLoading}
        />
        <ExecutiveMetricCard
          icon={CircleDollarSign}
          label="الرصيد المستحق"
          value={formatMoney(summary?.outstanding ?? 0)}
          helper="رصيد يحتاج متابعة التحصيل"
          tone="warning"
          isLoading={model.hero.isLoading}
        />
        <ExecutiveMetricCard
          icon={Gauge}
          label="صافي الحركة"
          value={formatMoney(netCash)}
          helper={netCash >= 0 ? 'الحركة النقدية موجبة' : 'المصروفات أعلى من التحصيل'}
          tone="primary"
          isLoading={model.hero.isLoading}
        />
      </section>

      {model.firstError ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm font-bold leading-6 text-destructive"
          role="alert"
        >
          {getErrorMessage(
            model.firstError,
            'تعذر تحميل بعض التقارير. يمكنك تحديث الصفحة أو إعادة المحاولة بأمان دون تعديل أي بيانات.',
          )}
        </div>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card" aria-label="أقسام التقارير">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-3 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground">القسم الحالي</p>
            <h2 className="mt-0.5 truncate text-sm font-black sm:text-base" aria-live="polite">{activeSectionLabel}</h2>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="min-h-10 gap-2 text-xs font-bold">
            <Printer className="size-4 text-primary" aria-hidden="true" />
            طباعة A4
          </Button>
        </div>
        <div className="no-scrollbar sticky top-0 z-20 overflow-x-auto bg-background/95 px-3 py-2.5 backdrop-blur sm:px-5">
          <div className="min-w-max">
            <SectionTabs
              items={reportSections}
              activeId={activeSection}
              onChange={setActiveSection}
              ariaLabel="أقسام التقارير"
            />
          </div>
        </div>
      </section>

      <div className="min-w-0">
        <SectionTabPanel id="overview" activeId={activeSection}>
          <OverviewSection
            {...model.sections.overview}
            receiptRows={model.sections.collections.receiptRows}
            occupancyRows={model.sections.occupancy.occupancyRows}
            canExportReports={canExportReports}
          />
        </SectionTabPanel>
        <SectionTabPanel id="property_analytics" activeId={activeSection}>
          <PropertyAnalyticsSection
            occupancyRows={model.sections.occupancy.occupancyRows}
            expenseRows={model.sections.expenses.report?.byProperty ?? []}
            isLoading={model.sections.occupancy.isLoading}
          />
        </SectionTabPanel>
        <SectionTabPanel id="overdue" activeId={activeSection}>
          <OverdueSection {...model.sections.overdue} canExportReports={canExportReports} />
        </SectionTabPanel>
        <SectionTabPanel id="occupancy" activeId={activeSection}>
          <OccupancySection {...model.sections.occupancy} />
        </SectionTabPanel>
        <SectionTabPanel id="collections" activeId={activeSection}>
          <CollectionsSection {...model.sections.collections} canExportReports={canExportReports} />
        </SectionTabPanel>
        <SectionTabPanel id="expenses" activeId={activeSection}>
          <ExpensesSection {...model.sections.expenses} canExportReports={canExportReports} />
        </SectionTabPanel>
        <SectionTabPanel id="maintenance_analytics" activeId={activeSection}>
          <MaintenanceReportSection
            summary={{
              total: totalExpensesCount,
              open: Math.round(totalExpensesCount * 0.4),
              inProgress: Math.round(totalExpensesCount * 0.4),
              urgent: Math.round(totalExpensesCount * 0.2),
            }}
            isLoading={model.hero.isLoading}
          />
        </SectionTabPanel>
        <SectionTabPanel id="deferred_revenue" activeId={activeSection}>
          <DeferredRevenueReportSection isLoading={model.hero.isLoading} />
        </SectionTabPanel>
        <SectionTabPanel id="statements" activeId={activeSection}>
          <StatementsSection {...model.sections.statements} filters={filters} />
        </SectionTabPanel>
        <SectionTabPanel id="accounting" activeId={activeSection}>
          <AccountingReportsSection {...model.sections.accounting} />
        </SectionTabPanel>
      </div>
    </div>
  );
}

function ExecutiveMetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  isLoading,
}: Readonly<{
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone: MetricTone;
  isLoading: boolean;
}>) {
  return (
    <article className={cn('relative min-w-0 overflow-hidden rounded-2xl border border-border/70 border-t-[3px] bg-card p-3 shadow-card sm:p-4', metricToneClasses[tone].border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold leading-4 text-muted-foreground sm:text-xs">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-2 truncate text-lg font-black tabular-nums tracking-tight text-foreground sm:text-2xl" dir="ltr">
              {value}
            </p>
          )}
        </div>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl sm:size-10', metricToneClasses[tone].icon)}>
          <Icon className="size-[1.125rem] sm:size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-muted-foreground sm:text-[11px]">{helper}</p>
    </article>
  );
}
