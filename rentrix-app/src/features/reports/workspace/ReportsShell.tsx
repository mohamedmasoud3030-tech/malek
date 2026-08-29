import { AlertTriangle, BookOpenCheck, Receipt } from 'lucide-react';
import { getErrorMessage } from '@/features/financials/components/financials-formatters';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import { cn } from '@/lib/utils';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';
import { getActiveReportMeta } from '../reports-page.meta';
import { ReportsFilterSurface } from '../components/ReportsFilterSurface';

type ReportsShellProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  activeSection: ReportSectionId;
  activeView: ReportViewId;
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
        'group inline-flex min-h-11 items-center gap-2 rounded-lg border border-border/70 px-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
        tone === 'warning' ? 'hover:bg-destructive/[0.035]' : 'hover:bg-primary/[0.025]',
      )}
    >
      <Icon className={cn('size-4 shrink-0', tone === 'warning' ? 'text-destructive' : 'text-primary')} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-muted-foreground">{label}</span>
        <span className="block text-sm font-black leading-5 tabular-nums text-foreground">{value}</span>
        <span className="hidden text-[11px] font-semibold text-muted-foreground md:block">{detail}</span>
      </span>
    </button>
  );
}

/**
 * The one compact header for the open report. It owns the report identity and
 * the active scope (via the context bar) and its single headline aggregation —
 * it is deliberately NOT a repeated four-KPI dashboard grid. Each report body
 * owns its own contextual executive strip.
 */
export function ReportsShell({
  model,
  filters,
  activeSection,
  activeView,
  onFiltersChange,
  onResetCurrentMonth,
  onSectionViewChange,
}: ReportsShellProps) {
  const companySettings = useCompanySettingsContract();
  const money = (value: number | null | undefined) => formatCompanyMoney(companySettings, value);
  const summary = model.hero.summary;
  const collectionRate = model.hero.collectionRate;
  const meta = getActiveReportMeta(activeSection, activeView);
  const isAccounting = activeSection === 'accounting';
  const isOperational = activeSection === 'analytics';

  return (
    <div className="space-y-2.5">
      <div data-report-summary-layer className="space-y-2.5 border-b border-border/55 pb-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h2 className="min-w-0 text-lg font-black leading-7 text-foreground">{meta.title}</h2>
            {meta.description ? (
              <p className="mt-0.5 max-w-3xl text-[13px] font-medium leading-5 text-muted-foreground">{meta.description}</p>
            ) : null}
          </div>

          {isOperational && summary ? (
            <div className="flex shrink-0 items-center gap-2">
              <MetricButton
                label="كفاءة التحصيل"
                value={`${Number.isFinite(collectionRate) ? Math.round(collectionRate) : 0}%`}
                detail={`${money(summary.paid ?? 0)} من ${money(summary.invoiced ?? 0)}`}
                icon={Receipt}
                onClick={() => onSectionViewChange('analytics', 'overview')}
              />
              {(summary.outstanding ?? 0) > 0 ? (
                <MetricButton
                  label="المتأخرات"
                  value={money(summary.outstanding ?? 0)}
                  detail={`${summary.invoicesCount ?? 0} فاتورة`}
                  icon={AlertTriangle}
                  tone="warning"
                  onClick={() => onSectionViewChange('analytics', 'overdue')}
                />
              ) : null}
            </div>
          ) : null}
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

      {isAccounting ? (
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
