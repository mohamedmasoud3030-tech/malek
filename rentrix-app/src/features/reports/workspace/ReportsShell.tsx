import { useMemo } from 'react';
import { AlertTriangle, BookOpenCheck, Building2, Receipt, TrendingUp } from 'lucide-react';
import { FinanceKpiCard, FinanceKpiGrid, FinanceSection } from '@/features/financials/components/finance-reporting-visual-foundations';
import { getErrorMessage } from '@/features/financials/components/financials-formatters';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';
import { ReportsFilterSurface } from '../components/ReportsFilterSurface';

type ReportsShellProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  activeSection: ReportSectionId;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
}>;

/** Reports scope + plain-language summary. The workspace model remains the data authority. */
export function ReportsShell({
  model,
  filters,
  activeSection,
  onFiltersChange,
  onResetCurrentMonth,
  onSectionViewChange,
}: ReportsShellProps) {
  const companySettings = useCompanySettingsContract();
  const money = (value: number | null | undefined) => formatCompanyMoney(companySettings, value);
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

  const collectionRate = model.hero.collectionRate;
  const plainLanguageInsight = (summary?.outstanding ?? 0) > 0
    ? `يوجد ${money(summary?.outstanding ?? 0)} مستحق يحتاج متابعة التحصيل في النطاق الحالي.`
    : occupancy.vacant > 0
      ? `يوجد ${occupancy.vacant} وحدات شاغرة؛ افتح تقرير الإشغال لمعرفة أين يتركز الشغور.`
      : 'لا تظهر في النطاق الحالي متأخرات أو شواغر تحتاج لفت انتباه فوري.';

  return (
    <>
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

      <FinanceSection ariaLabel="خلاصة التقرير">
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/[0.045] via-background to-background p-3 sm:p-4" data-report-summary-layer>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black text-primary">الخلاصة</p>
              <h2 className="mt-1 text-sm font-black sm:text-base">أهم ما تحتاج معرفته قبل التفاصيل</h2>
            </div>
            <p className="max-w-2xl text-xs font-semibold leading-5 text-muted-foreground">{plainLanguageInsight}</p>
          </div>
          <FinanceKpiGrid desktopColumns={4} className="mt-3">
            <FinanceKpiCard
              label="المحصّل للفترة"
              value={money(summary?.paid ?? 0)}
              icon={Receipt}
              sub={`${summary?.paymentsCount ?? 0} مدفوعات مسجلة`}
              trend={collectionRate >= 85 ? 'up' : collectionRate >= 65 ? 'neutral' : 'down'}
              trendValue={`كفاءة ${Math.round(collectionRate)}%`}
              accent="primary"
              onDrill={() => onSectionViewChange('analytics', 'collections')}
              drillAriaLabel={`المحصّل للفترة ${money(summary?.paid ?? 0)} — كفاءة التحصيل ${Math.round(collectionRate)}% — عرض تقرير التحصيل`}
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
              onDrill={() => onSectionViewChange('analytics', 'occupancy')}
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
              onDrill={() => onSectionViewChange('analytics', 'overdue')}
              drillAriaLabel={`الرصيد المستحق ${money(summary?.outstanding ?? 0)} — عرض تقرير المتأخرات`}
              unit={companySettings.defaultCurrency}
            />
            <FinanceKpiCard
              label="فرق التحصيل والمصروفات"
              value={money(summary?.netCash ?? 0)}
              icon={TrendingUp}
              sub="مؤشر متابعة تشغيلي للفترة، وليس صافي الربح."
              trend={(summary?.netCash ?? 0) >= 0 ? 'up' : 'down'}
              trendValue={(summary?.netCash ?? 0) >= 0 ? 'التحصيل أعلى' : 'المصروفات أعلى'}
              accent="primary"
              onDrill={() => onSectionViewChange('analytics', 'overview')}
              unit={companySettings.defaultCurrency}
            />
          </FinanceKpiGrid>
        </div>
      </FinanceSection>

      {activeSection === 'accounting' ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2.5 text-xs font-semibold leading-5 text-muted-foreground">
          <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            هذه مراجعة مالية متقدمة تعتمد على المصدر المحاسبي المعتمد. لا تُعرض كنقطة دخول أساسية لصاحب المكتب.
          </p>
        </div>
      ) : null}

      {model.firstError ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm font-semibold leading-6 text-destructive"
          role="alert"
          data-finance-error
        >
          {getErrorMessage(
            model.firstError,
            'تعذر تحميل بعض التقارير. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.',
          )}
        </div>
      ) : null}
    </>
  );
}
