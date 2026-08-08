import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  AlertTriangle,
  Building2,
  Receipt,
  TrendingUp,
  BookOpenCheck,
  Layers,
  Scale,
  FileSpreadsheet,
  ClipboardList,
  Wrench,
  LayoutDashboard
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { getErrorMessage } from '@/features/financials/components/financials-formatters';
import { FinanceKpiGrid, FinanceKpiCard, FinanceSection } from '@/features/financials/components/finance-reporting-visual-foundations';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { FilterState } from '../reports-page.helpers';
import {
  getReportCategoryLabel,
  reportCategories,
  reportSections,
  type ReportSectionId,
} from '../reports-page.sections';
import { ReportsFilterSurface } from './ReportsFilterSurface';

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
const GeneralLedgerCoreSection = lazy(() =>
  import('./GeneralLedgerCoreSection').then((m) => ({ default: m.GeneralLedgerCoreSection })),
);

const SectionFallback = () => <LoadingState variant="section" label="جارٍ تحميل التقرير..." />;

type ReportsWorkspaceProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: FilterState;
  canExportReports: boolean;
  activeSection: ReportSectionId;
  activeView: string;
  onSectionChange: (section: ReportSectionId) => void;
  onSectionViewChange: (section: ReportSectionId, view: string) => void;
  onFiltersChange: (filters: FilterState) => void;
  onResetCurrentMonth: () => void;
}>;

export function ReportsWorkspace({
  model,
  filters,
  canExportReports,
  activeSection,
  activeView,
  onSectionChange,
  onSectionViewChange,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsWorkspaceProps) {
  const companySettings = useCompanySettingsContract();
  
  const money = (value: number | null | undefined) => formatCompanyMoney(companySettings, value);
  const activeSectionMeta = reportSections.find((section) => section.id === activeSection) ?? reportSections[0];
  const ActiveSectionIcon = activeSectionMeta.icon;
  const summary = model.hero.summary;

  const handleAccountingViewChange = (viewId: string) => {
    onSectionViewChange('accounting', viewId);
  };

  const handleAnalyticsViewChange = (viewId: string) => {
    onSectionViewChange('analytics', viewId);
  };

  const accountingSubViews = useMemo(() => [
    { id: 'accounting_reports', label: 'ميزان المراجعة والقوائم', icon: Scale },
    { id: 'general_ledger', label: 'دفتر الأستاذ والشجرة', icon: BookOpenCheck },
    { id: 'deferred_revenue', label: 'تسوية الإيرادات', icon: Layers },
  ], []);

  const analyticsSubViews = useMemo(() => [
    { id: 'overview', label: 'نظرة عامة على الأداء', icon: LayoutDashboard },
    { id: 'collections', label: 'تحليلات التحصيل', icon: Receipt },
    { id: 'overdue', label: 'تعتيق المتأخرات', icon: AlertTriangle },
    { id: 'expenses', label: 'تحليلات المصاريف', icon: ClipboardList },
    { id: 'property_analytics', label: 'تحليلات العقارات', icon: Building2 },
    { id: 'occupancy', label: 'تحليلات الإشغال', icon: Building2 },
    { id: 'maintenance_analytics', label: 'تحليلات الصيانة', icon: Wrench },
  ], []);

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

  const collectionRate = (summary?.invoiced ?? 0) > 0 ? Math.round(((summary?.paid ?? 0) / (summary?.invoiced ?? 1)) * 100) : 0;

  return (
    <div className="space-y-5">
      <FinanceSection ariaLabel="نطاق التقرير">
        <ReportsFilterSurface
          filters={filters}
          costCenterRows={model.filters.costCenterRows}
          ownerRows={model.filters.ownerRows}
          contractRows={model.filters.contractRows}
          onChange={onFiltersChange}
          onResetCurrentMonth={onResetCurrentMonth}
        />
      </FinanceSection>

      <FinanceSection ariaLabel="المؤشرات التنفيذية">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">لوحة القرار</p>
            <h2 className="mt-1 text-sm font-extrabold">المؤشرات الأهم في النطاق الحالي — قابلة للنقر للتنقل</h2>
          </div>
          <span className="hidden text-[11px] font-semibold text-muted-foreground sm:block">مصادر مالية وتشغيلية موحّدة</span>
        </div>
        <FinanceKpiGrid desktopColumns={4}>
          <FinanceKpiCard
            label="المحصّل للفترة"
            value={money(summary?.paid ?? 0)}
            icon={Receipt}
            sub={`${summary?.paymentsCount ?? 0} مدفوعات مسجلة`}
            trend={collectionRate >= 85 ? 'up' : collectionRate >= 65 ? 'neutral' : 'down'}
            trendValue={`${collectionRate}%`}
            accent="primary"
            onDrill={() => onSectionChange('analytics')}
            drillAriaLabel={`المحصّل للفترة ${money(summary?.paid ?? 0)} — عرض تقرير التحصيل`}
            unit={companySettings.defaultCurrency}
          />
          <FinanceKpiCard
            label="نسبة الإشغال"
            value={`${occupancy.rate}%`}
            icon={Building2}
            sub={`${occupancy.occupied} من ${occupancy.total} وحدة`}
            trend={occupancy.rate >= 90 ? 'up' : occupancy.rate >= 75 ? 'neutral' : 'down'}
            trendValue={`${occupancy.vacant} شاغرة`}
            accent="primary"
            onDrill={() => onSectionChange('analytics')}
            drillAriaLabel={`نسبة الإشغال ${occupancy.rate}% — عرض تقرير الإشغال`}
          />
          <FinanceKpiCard
            label="الرصيد المستحق"
            value={money(summary?.outstanding ?? 0)}
            icon={AlertTriangle}
            sub="رصيد يحتاج متابعة التحصيل"
            trend="neutral"
            trendValue={`${summary?.invoicesCount ?? 0} فواتير`}
            accent="primary"
            onDrill={() => onSectionChange('analytics')}
            drillAriaLabel={`الرصيد المستحق ${money(summary?.outstanding ?? 0)} — عرض تقرير المتأخرات`}
            unit={companySettings.defaultCurrency}
          />
          <FinanceKpiCard
            label="صافي الحركة"
            value={money(summary?.netCash ?? 0)}
            icon={TrendingUp}
            sub={(summary?.netCash ?? 0) >= 0 ? 'الحركة النقدية موجبة' : 'المصروفات أعلى من التحصيل'}
            trend={(summary?.netCash ?? 0) >= 0 ? 'up' : 'down'}
            trendValue={(summary?.netCash ?? 0) >= 0 ? 'موجب' : 'سالب'}
            accent="primary"
            onDrill={() => onSectionChange('analytics')}
            unit={companySettings.defaultCurrency}
          />
        </FinanceKpiGrid>
      </FinanceSection>

      {model.firstError ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm font-semibold leading-6 text-destructive"
          role="alert"
          data-finance-error
        >
          {getErrorMessage(
            model.firstError,
            'تعذر تحميل بعض التقارير. يمكنك تحديث الصفحة أو إعادة المحاولة بأمان دون تعديل أي بيانات — الخطأ مميز عن حالة فارغة.',
          )}
        </div>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card" aria-label="أقسام التقارير" data-finance-card>
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ActiveSectionIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold sm:text-lg">{activeSectionMeta.label}</h2>
                <StatusBadge tone="info">{getReportCategoryLabel(activeSectionMeta)}</StatusBadge>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">{activeSectionMeta.description}</p>
            </div>
          </div>
        </div>

        {/* Mobile reports navigation */}
        <div className="border-b border-border/60 bg-card/95 px-3 py-3 sm:hidden" data-reports-mobile-nav>
          <label htmlFor="reports-section-select" className="sr-only">
            أقسام التقارير
          </label>
          <div className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ActiveSectionIcon className="size-4" aria-hidden="true" />
            </span>
            <select
              id="reports-section-select"
              aria-label="أقسام التقارير"
              value={activeSection}
              onChange={(e) => onSectionChange(e.target.value as ReportSectionId)}
              className="min-h-11 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              dir="rtl"
            >
              {reportSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop reports navigation */}
        <div
          className="no-scrollbar sticky top-0 z-20 hidden overflow-x-auto border-b border-border/60 bg-card/95 px-3 pt-3 backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 sm:block sm:px-4"
          tabIndex={0}
          role="region"
          aria-label="شريط أقسام التقارير القابل للتمرير أفقياً"
        >
          <div className="min-w-0 space-y-2">
            <SectionTabs
              items={reportSections}
              activeId={activeSection}
              onChange={onSectionChange}
              ariaLabel="أقسام التقارير"
            />
          </div>
        </div>
      </section>

      {/* Internal Sub-navigation Tabs */}
      {activeSection === 'accounting' && (
        <div className="border-b border-border/50 pb-2">
          <SectionTabs
            items={accountingSubViews}
            activeId={activeView}
            onChange={handleAccountingViewChange}
            ariaLabel="أقسام فرعية للمحاسبة"
          />
        </div>
      )}
      {activeSection === 'analytics' && (
        <div className="border-b border-border/50 pb-2">
          <SectionTabs
            items={analyticsSubViews}
            activeId={activeView}
            onChange={handleAnalyticsViewChange}
            ariaLabel="أقسام فرعية للتحليلات"
          />
        </div>
      )}

      {/* Render selected section & view */}
      <div className="min-w-0" key={activeSection}>
        <Suspense fallback={<SectionFallback />}>
          {/* Accounting Section & Views */}
          {activeSection === 'accounting' && activeView === 'accounting_reports' && (
            <SectionTabPanel id="accounting" activeId={activeSection}>
              <AccountingReportsSection {...model.sections.accounting} />
            </SectionTabPanel>
          )}
          {activeSection === 'accounting' && activeView === 'general_ledger' && (
            <SectionTabPanel id="accounting" activeId={activeSection}>
              <GeneralLedgerCoreSection />
            </SectionTabPanel>
          )}
          {activeSection === 'accounting' && activeView === 'deferred_revenue' && (
            <SectionTabPanel id="accounting" activeId={activeSection}>
              <DeferredRevenueReportSection {...model.sections.deferredRevenue} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}

          {/* Statements Section */}
          {activeSection === 'statements' && (
            <SectionTabPanel id="statements" activeId={activeSection}>
              <StatementsSection {...model.sections.statements} filters={filters} />
            </SectionTabPanel>
          )}

          {/* Analytics Section & Views */}
          {activeSection === 'analytics' && activeView === 'overview' && (
            <SectionTabPanel id="analytics" activeId={activeSection}>
              <OverviewSection
                {...model.sections.overview}
                receiptRows={model.sections.collections.receiptRows}
                occupancyRows={model.sections.occupancy.occupancyRows}
                canExportReports={canExportReports}
                isLoading={model.sections.overview.isLoading || model.sections.collections.isLoading || model.sections.occupancy.isLoading}
              />
            </SectionTabPanel>
          )}
          {activeSection === 'analytics' && activeView === 'collections' && (
            <SectionTabPanel id="analytics" activeId={activeSection}>
              <CollectionsSection {...model.sections.collections} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}
          {activeSection === 'analytics' && activeView === 'overdue' && (
            <SectionTabPanel id="analytics" activeId={activeSection}>
              <OverdueSection {...model.sections.overdue} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}
          {activeSection === 'analytics' && activeView === 'expenses' && (
            <SectionTabPanel id="analytics" activeId={activeSection}>
              <ExpensesSection {...model.sections.expenses} canExportReports={canExportReports} />
            </SectionTabPanel>
          )}
          {activeSection === 'analytics' && activeView === 'property_analytics' && (
            <SectionTabPanel id="analytics" activeId={activeSection}>
              <PropertyAnalyticsSection
                occupancyRows={model.sections.occupancy.occupancyRows}
                expenseRows={model.sections.expenses.report?.byProperty ?? []}
                isLoading={model.sections.occupancy.isLoading || model.sections.expenses.isLoading}
              />
            </SectionTabPanel>
          )}
          {activeSection === 'analytics' && activeView === 'occupancy' && (
            <SectionTabPanel id="analytics" activeId={activeSection}>
              <OccupancySection {...model.sections.occupancy} />
            </SectionTabPanel>
          )}
          {activeSection === 'analytics' && activeView === 'maintenance_analytics' && (
            <SectionTabPanel id="analytics" activeId={activeSection}>
              <MaintenanceReportSection {...model.sections.maintenance} />
            </SectionTabPanel>
          )}
        </Suspense>
      </div>
    </div>
  );
}
