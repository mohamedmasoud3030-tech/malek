import { useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { invoiceStatusLabels } from '@/features/financials/components/invoice-status-labels';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { ReportFilterFieldId, ReportsFilterState } from '../reports-workspace-filters';
import { buildReportFilterSummary } from '../reports-filter-summary';
import { describeReportFilterSelections, getSelectedFilterEntities } from '../reports-filters.shared';
import { FiltersPanel } from './FiltersPanel';

type ReportsFilterSurfaceProps = Readonly<{
  filters: ReportsFilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  visibleFields?: readonly ReportFilterFieldId[];
  onChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>;

/**
 * Reports scope + filter surface.
 *
 * One owner for the report filter summary contract:
 * - the scope summary text is derived through `buildReportFilterSummary`
 *   (the single formatter for report filter chips/labels) instead of being
 *   re-derived inline;
 * - the actual filter controls are the `FiltersPanel` adapter over the
 *   canonical `FilterBar`, so desktop inline controls, the shared mobile
 *   sheet, active-filter chips and clear/reset behavior are NOT duplicated
 *   here. The previous own BottomSheet + apply footer is gone.
 */
export function ReportsFilterSurface({
  filters,
  costCenterRows,
  ownerRows,
  contractRows,
  visibleFields,
  onChange,
  onResetCurrentMonth,
}: ReportsFilterSurfaceProps) {
  const labels = describeReportFilterSelections(
    getSelectedFilterEntities(filters, costCenterRows, ownerRows, contractRows),
  );
  const summary = useMemo(
    () => buildReportFilterSummary(filters, filters, {
      ...labels,
      status: filters.status && filters.status !== 'all' ? (invoiceStatusLabels[filters.status] ?? filters.status) : undefined,
    }),
    [filters, labels],
  );
  const scopeLabel = summary.activeCount === 0 ? 'الشهر الحالي' : summary.label;

  return (
    <div className="min-w-0 space-y-2">
      <div
        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"
        data-report-filter-surface
        role="region"
        aria-label="نطاق التقرير الحالي"
      >
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-muted/40 px-2.5 text-[11px] font-bold text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          <span className="min-w-0">{scopeLabel}</span>
        </span>
      </div>

      <FiltersPanel
        filters={filters}
        costCenterRows={costCenterRows}
        ownerRows={ownerRows}
        contractRows={contractRows}
        visibleFields={visibleFields}
        onChange={onChange}
        onResetCurrentMonth={onResetCurrentMonth}
      />
    </div>
  );
}
