import { AlertTriangle, BookOpenCheck, Receipt } from 'lucide-react';
import { getErrorMessage } from '@/features/financials/components/financials-formatters';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import { cn } from '@/lib/utils';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportViewId } from '../report-view-registry';
import { getActiveReportMeta } from '../reports-page.meta';
import { getReportWorkspace, type ReportWorkspaceId } from '../report-workspaces';
import { ReportsFilterSurface } from '../components/ReportsFilterSurface';
import { WorkspaceSubViewTabs } from './WorkspaceSubViewTabs';

type ReportsShellProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  activeWorkspace: ReportWorkspaceId;
  activeView: ReportViewId;
  onOpenView: (view: ReportViewId) => void;
  onOpenReport?: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
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
 * The one compact header for the open workspace. It owns the workspace
 * identity, its sub-view switcher and the active scope (via the context bar).
 * Collection shortcuts render the canonical metric meanings without creating
 * a second KPI grid inside the report body.
 */
export function ReportsShell({
  model,
  filters,
  activeWorkspace,
  activeView,
  onOpenView,
  onOpenReport,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsShellProps) {
  const companySettings = useCompanySettingsContract();
  const money = (value: number | null | undefined) => formatCompanyMoney(companySettings, value);
  const workspace = getReportWorkspace(activeWorkspace);
  const summary = model.hero.summary;
  const collectionRate = model.sections.collections.collectionRate;
  const meta = getActiveReportMeta(activeWorkspace, activeView);
  const isSpecialist = workspace?.specialist ?? false;
  const isCollections = activeWorkspace === 'collections';

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

          {isCollections && summary ? (
            <div className="flex shrink-0 items-center gap-2">
              <MetricButton
                label="كفاءة التحصيل"
                value={Number.isFinite(collectionRate) ? `${Math.round(collectionRate!)}%` : '—'}
                detail={Number.isFinite(collectionRate) ? `${money(summary.paid ?? 0)} من ${money(summary.invoiced ?? 0)}` : 'المؤشر المعتمد غير متاح حاليًا'}
                icon={Receipt}
                onClick={() => onOpenView('collections')}
              />
              {(summary.outstanding ?? 0) > 0 ? (
                <MetricButton
                  label="الرصيد المستحق"
                  value={money(summary.outstanding ?? 0)}
                  detail="يشمل الجاري والمتأخر"
                  icon={AlertTriangle}
                  onClick={() => onOpenView('overdue')}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {workspace ? (
          <WorkspaceSubViewTabs
            activeWorkspace={activeWorkspace}
            activeView={activeView}
            onOpen={(nextWorkspace, nextView) => {
              if (onOpenReport) onOpenReport(nextWorkspace, nextView);
              else if (nextWorkspace === activeWorkspace) onOpenView(nextView);
            }}
          />
        ) : null}

        <ReportsFilterSurface
          filters={filters}
          costCenterRows={model.filters.costCenterRows}
          ownerRows={model.filters.ownerRows}
          contractRows={model.filters.contractRows}
          visibleFields={workspace?.visibleFilterFields}
          onChange={onFiltersChange}
          onResetCurrentMonth={onResetCurrentMonth}
        />
      </div>

      {isSpecialist ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/[0.025] px-3 py-2.5 text-xs font-semibold leading-5 text-muted-foreground">
          <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>هذه مراجعة مالية متقدمة تعتمد على المصدر المحاسبي المعتمد، وهي خارج التنقل اليومي للمكتب.</p>
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
