import { useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { invoiceStatusLabels } from '@/features/financials/components/invoice-status-labels';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { ReportFilterFieldId, ReportsFilterState } from '../reports-workspace-filters';
import { getInitialReportsFilters } from '../reports-workspace-filters';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { buildReportFilterSummary } from '../reports-filter-summary';
import { describeReportFilterSelections, getSelectedFilterEntities } from '../reports-filters.shared';
import { FiltersPanel } from './FiltersPanel';

type ReportsFilterSurfaceProps = Readonly<{
  filters: ReportsFilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  visibleFields?: readonly ReportFilterFieldId[];
  /** Statement filter wording must never describe the account record as a report. */
  contentKind?: 'report' | 'statement';
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
  contentKind = 'report',
  onChange,
  onResetCurrentMonth,
}: ReportsFilterSurfaceProps) {
  const labels = describeReportFilterSelections(
    getSelectedFilterEntities(filters, costCenterRows, ownerRows, contractRows),
  );
  const defaults = useMemo(() => getInitialReportsFilters(), []);
  const summary = useMemo(
    () => buildReportFilterSummary(filters, defaults, {
      ...labels,
      status: filters.status && filters.status !== 'all' ? (invoiceStatusLabels[filters.status] ?? filters.status) : undefined,
    }),
    [defaults, filters, labels],
  );
  const activeFilters = useMemo<ActiveFilterItem[]>(
    () => summary.chips
      .filter((chip) => chip.isActive && (visibleFields?.includes(chip.key) ?? true))
      .map((chip) => ({
        key: `report-${chip.key}`,
        label: chip.label,
        value: chip.value,
        onRemove: () => {
          if (chip.key === 'period') onChange({ ...filters, from: defaults.from, to: defaults.to });
          else if (chip.key === 'asOf') onChange({ ...filters, asOf: defaults.asOf });
          else if (chip.key === 'property') onChange({ ...filters, propertyId: '', unitId: '', tenantId: '', contractId: '' });
          else if (chip.key === 'unit') onChange({ ...filters, unitId: '', tenantId: '', contractId: '' });
          else if (chip.key === 'tenant') onChange({ ...filters, tenantId: '', contractId: '' });
          else if (chip.key === 'costCenter') onChange({ ...filters, costCenterId: '' });
          else if (chip.key === 'owner') onChange({ ...filters, ownerId: '' });
          else if (chip.key === 'contract') onChange({ ...filters, contractId: '' });
          else if (chip.key === 'status') onChange({ ...filters, status: 'all' });
        },
      })),
    [defaults, filters, onChange, summary.chips, visibleFields],
  );
  const clearAllFilters = () => {
    onChange({ ...defaults, propertyId: '', unitId: '', tenantId: '', costCenterId: '', ownerId: '', contractId: '', status: 'all' });
  };
  const isStatement = contentKind === 'statement';
  const scopeLabel =
    summary.activeCount === 0
      ? isStatement
        ? 'اختر العقد'
        : 'الشهر الحالي'
      : summary.label;
  const scopeNoun = isStatement ? 'الكشف' : 'التقرير';
  const supportsPeriodReset = visibleFields?.includes('period') ?? true;

  return (
    <div
      className="min-w-0 space-y-2"
      data-statement-filter-surface={isStatement ? '' : undefined}
    >
      <div
        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"
        data-report-filter-surface={!isStatement ? '' : undefined}
        role="region"
        aria-label={`نطاق ${scopeNoun} الحالي`}
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
        contentKind={contentKind}
        showPeriodReset={supportsPeriodReset}
        activeFilters={activeFilters}
        onClearAllFilters={activeFilters.length > 0 ? clearAllFilters : undefined}
        onChange={onChange}
        onResetCurrentMonth={onResetCurrentMonth}
      />
    </div>
  );
}
