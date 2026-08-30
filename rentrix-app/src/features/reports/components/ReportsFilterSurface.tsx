import { useMemo, useState } from 'react';
import { CalendarRange, Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { invoiceStatusLabels } from '@/features/financials/components/invoice-status-labels';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportFilterFieldId } from '../report-workspaces';
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
 * Reports surface does not re-derive the default scope here; it reads it from
 * the workspace filters so the "This month" baseline always matches what the
 * data layer actually renders.
 */
function readDefaultScope(filters: ReportsFilterState): Pick<ReportsFilterState, 'from' | 'to' | 'asOf'> {
  return { from: filters.from, to: filters.to, asOf: filters.asOf };
}

export function ReportsFilterSurface({
  filters,
  costCenterRows,
  ownerRows,
  contractRows,
  visibleFields,
  onChange,
  onResetCurrentMonth,
}: ReportsFilterSurfaceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { from: defaultFrom, to: defaultTo, asOf: defaultAsOf } = useMemo(() => readDefaultScope(filters), [filters]);
  const labels = describeReportFilterSelections(
    getSelectedFilterEntities(filters, costCenterRows, ownerRows, contractRows),
  );
  const scopeSummary = useMemo(() => {
    const parts: string[] = [];
    const periodLabel = filters.from === defaultFrom && filters.to === defaultTo
      ? 'الشهر الحالي'
      : `${filters.from} — ${filters.to}`;
    parts.push(periodLabel);
    if (filters.propertyId && labels.property) parts.push(`العقار: ${labels.property}`);
    if (filters.unitId && labels.unit) parts.push(`الوحدة: ${labels.unit}`);
    if (filters.tenantId && labels.tenant) parts.push(`المستأجر: ${labels.tenant}`);
    if (filters.ownerId && labels.owner) parts.push(labels.owner);
    if (filters.contractId && labels.contract) parts.push(`العقد: ${labels.contract}`);
    if (filters.costCenterId && labels.costCenter) parts.push(`مركز التكلفة: ${labels.costCenter}`);
    if (filters.status && filters.status !== 'all') parts.push(`الحالة: ${invoiceStatusLabels[filters.status] ?? filters.status}`);
    return parts.join(' · ');
  }, [defaultFrom, defaultTo, filters, labels]);

  const isDefaultPeriod = filters.from === defaultFrom && filters.to === defaultTo && filters.asOf === defaultAsOf;

  return (
    <>
      <div
        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"
        data-report-filter-surface
        role="region"
        aria-label="نطاق التقرير الحالي"
      >
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-muted/40 px-2.5 text-[11px] font-bold text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          <span className="min-w-0">{scopeSummary}</span>
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {!isDefaultPeriod ? (
            <button
              type="button"
              onClick={onResetCurrentMonth}
              aria-label="إعادة نطاق التقرير إلى الشهر الحالي"
              title="الشهر الحالي"
              className="grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <Button type="button" variant="ghost" className="min-h-11 gap-1.5 px-2 text-xs font-black" onClick={() => setIsOpen(true)}>
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            تعديل النطاق
          </Button>
        </div>
      </div>

      <BottomSheet open={isOpen} onClose={() => setIsOpen(false)} title="فلترة نطاق التقرير">
        <div id="reports-filter-sheet" className="space-y-4">
          <FiltersPanel
            filters={filters}
            costCenterRows={costCenterRows}
            ownerRows={ownerRows}
            contractRows={contractRows}
            visibleFields={visibleFields}
            onChange={onChange}
            onResetCurrentMonth={onResetCurrentMonth}
          />
          <div className="border-t border-border/60 pt-4">
            <Button type="button" className="min-h-11 w-full" onClick={() => setIsOpen(false)}>
              <Check className="me-2 size-4" aria-hidden="true" />
              تطبيق وعرض النتائج
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
