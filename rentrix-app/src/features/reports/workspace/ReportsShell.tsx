import { useMemo } from 'react';
import { AlertTriangle, Building2, Receipt, TrendingUp } from 'lucide-react';
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
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
}>;

/**
 * WP-C — Reports shell: the scope/filter bar, the clickable decision board and
 * the workspace-level error surface.
 *
 * Presentation only. Every number rendered here is read straight off the
 * workspace model produced by the authoritative Accounting / Finance services;
 * the shell performs no monetary arithmetic of its own (the only local maths is
 * a unit-count occupancy percentage, which is a presentation-level count, not
 * an accounting figure).
 */
export function ReportsShell({
  model,
  filters,
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

  // Same server-derived, credit-aware invoice-cohort metric as Dashboard Truth.
  const collectionRate = model.hero.collectionRate;

  return (
    <>
      <FinanceSection ariaLabel="نطاق التقرير">
        <div className="rounded-2xl border border-border/60 bg-background/55 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-black text-primary">نطاق التحليل</p>
              <h3 className="mt-0.5 text-sm font-black">حدد الفترة والكيان قبل قراءة الأرقام</h3>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">الفلاتر تُحفظ أثناء التنقل بين التقارير</span>
          </div>
          <ReportsFilterSurface
            filters={filters}
            costCenterRows={model.filters.costCenterRows}
            ownerRows={model.filters.ownerRows}
            contractRows={model.filters.contractRows}
            onChange={onFiltersChange}
            onResetCurrentMonth={onResetCurrentMonth}
          />
        </div>
      </FinanceSection>

      <FinanceSection ariaLabel="المؤشرات التنفيذية">
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/[0.045] via-background to-background p-3 sm:p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black text-primary">لوحة القرار</p>
              <h2 className="mt-1 text-sm font-black sm:text-base">أهم المؤشرات في النطاق الحالي — اضغط للوصول للتحليل</h2>
            </div>
            <span className="hidden rounded-full border border-border/60 bg-background/75 px-3 py-1 text-xs font-semibold text-muted-foreground sm:block">
              مصادر مالية وتشغيلية موحّدة
            </span>
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
              sub="فرق تشغيلي فقط — ليس ربح المكتب ولا قائمة تدفق نقدي كاملة"
              trend={(summary?.netCash ?? 0) >= 0 ? 'up' : 'down'}
              trendValue={(summary?.netCash ?? 0) >= 0 ? 'التحصيل أعلى' : 'المصروفات أعلى'}
              accent="primary"
              onDrill={() => onSectionViewChange('analytics', 'overview')}
              unit={companySettings.defaultCurrency}
            />
          </FinanceKpiGrid>
        </div>
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
    </>
  );
}
