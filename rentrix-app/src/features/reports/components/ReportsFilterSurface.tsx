import { useMemo, useState } from 'react';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { buildReportFilterSummary } from '../reports-filter-summary';
import { getCurrentMonthFilters, type FilterState } from '../reports-page.helpers';
import { getSelectedFilterEntities } from '../reports-filters.shared';
import { FiltersPanel } from './FiltersPanel';

type ReportsFilterSurfaceProps = Readonly<{
  filters: FilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  onChange: (filters: FilterState) => void;
  onResetCurrentMonth: () => void;
}>;

export function ReportsFilterSurface({
  filters,
  costCenterRows,
  ownerRows,
  contractRows,
  onChange,
  onResetCurrentMonth,
}: ReportsFilterSurfaceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const defaults = useMemo(() => getCurrentMonthFilters(), []);
  const { selectedCostCenter, selectedOwner, selectedContract } = getSelectedFilterEntities(
    filters,
    costCenterRows,
    ownerRows,
    contractRows,
  );
  const summary = buildReportFilterSummary(filters, defaults, {
    costCenter: selectedCostCenter,
    owner: selectedOwner?.display_name ?? selectedOwner?.full_name,
    contract: selectedContract ? `عقد ${selectedContract.id.slice(0, 8)}` : undefined,
  });

  return (
    <>
      <section
        className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between"
        aria-label="نطاق التقرير"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="size-[1.125rem]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold">نطاق التقرير</h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {summary.activeCount > 0 ? `${summary.activeCount} فلاتر نشطة` : 'الشهر الحالي'}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs font-medium text-muted-foreground" aria-live="polite">
              {summary.label}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onResetCurrentMonth}
            disabled={summary.activeCount === 0}
          >
            <RotateCcw className="me-2 size-4" aria-hidden="true" />
            الشهر الحالي
          </Button>
          <Button type="button" className="min-h-11" onClick={() => setIsOpen(true)}>
            <SlidersHorizontal className="me-2 size-4" aria-hidden="true" />
            تعديل النطاق
          </Button>
        </div>
      </section>

      <BottomSheet open={isOpen} onClose={() => setIsOpen(false)} title="فلترة نطاق التقرير">
        <div id="reports-filter-sheet" className="space-y-4">
          <FiltersPanel
            filters={filters}
            costCenterRows={costCenterRows}
            ownerRows={ownerRows}
            contractRows={contractRows}
            onChange={onChange}
            onResetCurrentMonth={onResetCurrentMonth}
          />
          <div className="border-t border-border/60 pt-4">
            <Button type="button" className="min-h-11 w-full" onClick={() => setIsOpen(false)}>
              <Check className="me-2 size-4" aria-hidden="true" />
              عرض النتائج
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
