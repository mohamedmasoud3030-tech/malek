import { useMemo } from 'react';
import { AlertTriangle, BookOpenCheck, Building2, Receipt, SlidersHorizontal, TrendingUp } from 'lucide-react';
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

/**
 * Reports scope + context shell.
 *
 * Operational KPIs belong to Analytics only. Accounting and statements no
 * longer start with collection/occupancy cards that compete with the ledger or
 * the financial statements. The numbers are still read directly from the
 * authoritative workspace model; this module performs no monetary arithmetic.
 */
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

  // Same server-derived, credit-aware invoice-cohort metric as Dashboard Truth.
  const collectionRate = model.hero.collectionRate;

  return (
    <>
      <FinanceSection ariaLabel="نطاق التقرير">
        <div className="rounded-2xl border border-border/65 bg-card p-2.5 shadow-sm sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-black">نطاق التقرير</p>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {filters.from} — {filters.to} · حتى {filters.asOf}
                </p>
              </div>
            </div>
            <span className="hidden text-[11px] font-bold text-muted-foreground sm:inline">
              النطاق يبقى محفوظًا أثناء التنقل
            </span>
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

      {activeSection === 'accounting' ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2.5 text-xs font-semibold leading-5 text-muted-foreground">
          <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            المخرجات المحاسبية هنا تعتمد على القيود المرحّلة والمطابقة مع الأستاذ العام؛ الطباعة وPDF يظلان محجوبين إذا كانت المطابقة غير جاهزة.
          </p>
        </div>
      ) : null}

      {activeSection === 'analytics' ? (
        <FinanceSection ariaLabel="المؤشرات التنفيذية">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/[0.045] via-background to-background p-3 sm:p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-primary">لوحة القرار</p>
                <h2 className="mt-1 text-sm font-black sm:text-base">أهم المؤشرات في النطاق الحالي</h2>
              </div>
              <span className="hidden rounded-full border border-border/60 bg-background/75 px-3 py-1 text-xs font-semibold text-muted-foreground sm:block">
                اضغط للوصول للتحليل
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
      ) : null}

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
