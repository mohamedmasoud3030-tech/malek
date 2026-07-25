import { lazy, Suspense, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Printer, Receipt, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { FilterState } from '../reports-page.helpers';
import { reportSections, type ReportSectionId } from '../reports-page.sections';
import { ReportsFilterSurface } from './ReportsFilterSurface';

// Only the first-viewed tab (overview) is loaded eagerly; the other nine are
// heavy report sections (some pulling PDF/export services) that most visits
// never open. React.lazy defers each section's JS — and its data-service
// imports — until the user actually selects that tab.
const OverviewSection = lazy(() => import('./OverviewSection').then((m) => ({ default: m.OverviewSection })));
const PropertyAnalyticsSection = lazy(() =>
  import('./PropertyAnalyticsSection').then((m) => ({ default: m.PropertyAnalyticsSection })),
);
const OverdueSection = lazy(() => import('./OverdueSection').then((m) => ({ default: m.OverdueSection })));
const OccupancySection = lazy(() => import('./OccupancySection').then((m) => ({ default: m.OccupancySection })));
const CollectionsSection = lazy(() => import('./CollectionsSection').then((m) => ({ default: m.CollectionsSection })));
const ExpensesSection = lazy(() => import('./ExpensesSection').then((m) => ({ default: m.ExpensesSection })));
const MaintenanceReportSection = lazy(() =>
  import('./MaintenanceReportSection').then((m) => ({ default: m.MaintenanceReportSection })),
);
const DeferredRevenueReportSection = lazy(() =>
  import('./DeferredRevenueReportSection').then((m) => ({ default: m.DeferredRevenueReportSection })),
);
const StatementsSection = lazy(() => import('./StatementsSection').then((m) => ({ default: m.StatementsSection })));
const AccountingReportsSection = lazy(() =>
  import('./AccountingReportsSection').then((m) => ({ default: m.AccountingReportsSection })),
);

const SectionFallback = () => <LoadingState variant="section" label="جارٍ تحميل التقرير..." />;

type ReportsWorkspaceProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: FilterState;
  canExportReports: boolean;
  onFiltersChange: (filters: FilterState) => void;
  onResetCurrentMonth: () => void;
}>;

export function ReportsWorkspace({
  model,
  filters,
  canExportReports,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<ReportSectionId>('overview');
  const activeSectionMeta = reportSections.find((section) => section.id === activeSection) ?? reportSections[0];
  const ActiveSectionIcon = activeSectionMeta.icon;
  const summary = model.hero.summary;

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

  const collectionRate = (summary?.invoiced ?? 0) > 0
    ? Math.round(((summary?.paid ?? 0) / (summary?.invoiced ?? 1)) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <ReportsFilterSurface
        filters={filters}
        costCenterRows={model.filters.costCenterRows}
        ownerRows={model.filters.ownerRows}
        contractRows={model.filters.contractRows}
        onChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
      />

      <section aria-label="المؤشرات التنفيذية" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">لوحة القرار</p>
            <h2 className="mt-1 text-sm font-extrabold">المؤشرات الأهم في النطاق الحالي</h2>
          </div>
          <span className="hidden text-[11px] font-semibold text-muted-foreground sm:block">مصادر مالية وتشغيلية موحّدة</span>
        </div>
        <ResponsiveCardGrid>
          <KpiCard
            label="المحصّل للفترة"
            value={formatMoney(summary?.paid ?? 0)}
            icon={Receipt}
            sub={`${summary?.paymentsCount ?? 0} مدفوعات مسجلة`}
            trend={collectionRate >= 85 ? 'up' : collectionRate >= 65 ? 'neutral' : 'down'}
            trendValue={`${collectionRate}%`}
          />
          <KpiCard
            label="نسبة الإشغال"
            value={`${occupancy.rate}%`}
            icon={Building2}
            sub={`${occupancy.occupied} من ${occupancy.total} وحدة`}
            trend={occupancy.rate >= 90 ? 'up' : occupancy.rate >= 75 ? 'neutral' : 'down'}
            trendValue={`${occupancy.vacant} شاغرة`}
          />
          <KpiCard
            label="الرصيد المستحق"
            value={formatMoney(summary?.outstanding ?? 0)}
            icon={AlertTriangle}
            sub="رصيد يحتاج متابعة التحصيل"
            trend="neutral"
            trendValue={`${summary?.invoicesCount ?? 0} فواتير`}
          />
          <KpiCard
            label="صافي الحركة"
            value={formatMoney(summary?.netCash ?? 0)}
            icon={TrendingUp}
            sub={(summary?.netCash ?? 0) >= 0 ? 'الحركة النقدية موجبة' : 'المصروفات أعلى من التحصيل'}
            trend={(summary?.netCash ?? 0) >= 0 ? 'up' : 'down'}
            trendValue={(summary?.netCash ?? 0) >= 0 ? 'موجب' : 'سالب'}
          />
        </ResponsiveCardGrid>
      </section>

      {model.firstError ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm font-semibold leading-6 text-destructive"
          role="alert"
        >
          {getErrorMessage(
            model.firstError,
            'تعذر تحميل بعض التقارير. يمكنك تحديث الصفحة أو إعادة المحاولة بأمان دون تعديل أي بيانات.',
          )}
        </div>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card" aria-label="أقسام التقارير">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ActiveSectionIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold sm:text-lg">{activeSectionMeta.label}</h2>
                <StatusBadge tone="info">{activeSectionMeta.group}</StatusBadge>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">
                {activeSectionMeta.description}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="min-h-10 shrink-0 gap-2 text-xs">
            <Printer className="size-4" aria-hidden="true" />
            طباعة التبويب
          </Button>
        </div>

        <div className="no-scrollbar sticky top-0 z-20 overflow-x-auto border-b border-border/60 bg-card/95 px-3 pt-3 backdrop-blur sm:px-4">
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

      <div className="min-w-0" key={activeSection}>
        <Suspense fallback={<SectionFallback />}>
          {activeSection === 'overview' && (
            <SectionTabPanel id="overview" activeId={activeSection}>
              <OverviewSection
                {...model.sections.overview}
                receiptRows={model.sections.collections.receiptRows}
                occupancyRows={model.sections.occupancy.occupancyRows}
                canExportReports={canExportReports}
                isLoading={
                  model.sections.overview.isLoading
                  || model.sections.collections.isLoading
                  || model.sections.occupancy.isLoading
                }
              />
            </SectionTabPanel>
          )}
          {activeSection === 'property_analytics' && (
            <SectionTabPanel id="property_analytics" activeId={activeSection}>
              <PropertyAnalyticsSection
                occupancyRows={model.sections.occupancy.occupancyRows}
                expenseRows={model.sections.expenses.report?.byProperty ?? []}
                isLoading={model.sections.occupancy.isLoading || model.sections.expenses.isLoading}
              />
            </SectionTabPanel>
          )}
          {activeSection === 'overdue' && (
            <SectionTabPanel id="overdue" activeId={activeSection}>
              <OverdueSection {...model.sections.overdue} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}
          {activeSection === 'occupancy' && (
            <SectionTabPanel id="occupancy" activeId={activeSection}>
              <OccupancySection {...model.sections.occupancy} />
            </SectionTabPanel>
          )}
          {activeSection === 'collections' && (
            <SectionTabPanel id="collections" activeId={activeSection}>
              <CollectionsSection {...model.sections.collections} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}
          {activeSection === 'expenses' && (
            <SectionTabPanel id="expenses" activeId={activeSection}>
              <ExpensesSection {...model.sections.expenses} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}
          {activeSection === 'maintenance_analytics' && (
            <SectionTabPanel id="maintenance_analytics" activeId={activeSection}>
              <MaintenanceReportSection {...model.sections.maintenance} />
            </SectionTabPanel>
          )}
          {activeSection === 'deferred_revenue' && (
            <SectionTabPanel id="deferred_revenue" activeId={activeSection}>
              <DeferredRevenueReportSection {...model.sections.deferredRevenue} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}
          {activeSection === 'statements' && (
            <SectionTabPanel id="statements" activeId={activeSection}>
              <StatementsSection {...model.sections.statements} filters={filters} />
            </SectionTabPanel>
          )}
          {activeSection === 'accounting' && (
            <SectionTabPanel id="accounting" activeId={activeSection}>
              <AccountingReportsSection {...model.sections.accounting} />
            </SectionTabPanel>
          )}
        </Suspense>
      </div>
    </div>
  );
}
