import { useMemo } from 'react';
import { AlertTriangle, BookOpenCheck, Building2, Receipt, TrendingUp } from 'lucide-react';
import { getErrorMessage } from '@/features/financials/components/financials-formatters';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import { cn } from '@/lib/utils';
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

type MetricButtonProps = Readonly<{
  label: string;
  value: string;
  detail: string;
  icon: typeof Receipt;
  onClick: () => void;
  tone?: 'default' | 'warning';
}>;

function MetricButton({ label, value, detail, icon: Icon, onClick, tone = 'default' }: MetricButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group min-w-0 px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:px-4 sm:py-3',
        tone === 'warning' ? 'hover:bg-destructive/[0.035]' : 'hover:bg-primary/[0.025]',
      )}
    >
      <span className="flex items-center gap-2 text-[11px] font-black text-muted-foreground sm:text-xs">
        <Icon className={cn('size-3.5 shrink-0', tone === 'warning' ? 'text-destructive' : 'text-primary')} aria-hidden="true" />
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-black tabular-nums text-foreground sm:text-base">{value}</span>
      <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground sm:text-xs">{detail}</span>
    </button>
  );
}

/** Global report scope plus one compact executive readout. Report bodies own their detailed analysis. */
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

  return (
    <div className="space-y-3">
      <ReportsFilterSurface
        filters={filters}
        costCenterRows={model.filters.costCenterRows}
        ownerRows={model.filters.ownerRows}
        contractRows={model.filters.contractRows}
        onChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
      />

      <section
        className="overflow-hidden rounded-xl border border-border/80 bg-card"
        aria-label="خلاصة الفترة"
        data-report-summary-layer
      >
        <div className="grid grid-cols-2 divide-x divide-y divide-border/70 sm:grid-cols-4 sm:divide-y-0 rtl:divide-x-reverse">
          <MetricButton
            label="المحصّل"
            value={money(summary?.paid ?? 0)}
            detail={`${Math.round(collectionRate)}% من المطلوب`}
            icon={Receipt}
            onClick={() => onSectionViewChange('analytics', 'collections')}
          />
          <MetricButton
            label="الإشغال"
            value={`${occupancy.rate}%`}
            detail={`${occupancy.vacant} وحدة شاغرة`}
            icon={Building2}
            onClick={() => onSectionViewChange('analytics', 'occupancy')}
          />
          <MetricButton
            label="المستحق"
            value={money(summary?.outstanding ?? 0)}
            detail={`${summary?.invoicesCount ?? 0} فواتير`}
            icon={AlertTriangle}
            tone={(summary?.outstanding ?? 0) > 0 ? 'warning' : 'default'}
            onClick={() => onSectionViewChange('analytics', 'overdue')}
          />
          <MetricButton
            label="التحصيل − المصروفات"
            value={money(summary?.netCash ?? 0)}
            detail={(summary?.netCash ?? 0) >= 0 ? 'التحصيل أعلى' : 'المصروفات أعلى'}
            icon={TrendingUp}
            onClick={() => onSectionViewChange('analytics', 'overview')}
          />
        </div>
      </section>

      {activeSection === 'accounting' ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/[0.025] px-3 py-2.5 text-xs font-semibold leading-5 text-muted-foreground">
          <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>هذه مراجعة مالية متقدمة تعتمد على المصدر المحاسبي المعتمد.</p>
        </div>
      ) : null}

      {model.firstError ? (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm font-semibold leading-6 text-destructive"
          role="alert"
          data-finance-error
        >
          {getErrorMessage(
            model.firstError,
            'تعذر تحميل بعض التقارير. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.',
          )}
        </div>
      ) : null}
    </div>
  );
}
