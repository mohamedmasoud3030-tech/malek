import { useMemo, useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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

  const filtersPanel = (
    <FiltersPanel
      filters={filters}
      costCenterRows={costCenterRows}
      ownerRows={ownerRows}
      contractRows={contractRows}
      onChange={onChange}
      onResetCurrentMonth={onResetCurrentMonth}
    />
  );

  return (
    <>
      <section className="hidden rounded-2xl border border-border/70 bg-card p-3 shadow-card md:block" aria-label="فلاتر التقارير">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-[1.125rem]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold">نطاق التقرير</h2>
              <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground" aria-live="polite">
                {summary.label}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-bold text-success">
            {summary.activeCount > 0 ? `${summary.activeCount} فلاتر نشطة` : 'الشهر الحالي'}
          </span>
        </div>
        <div className="mt-3 border-t border-border/60 pt-3">{filtersPanel}</div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-3 shadow-card md:hidden" aria-label="فلاتر التقارير">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">نطاق التقرير</h2>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                {summary.activeCount > 0 ? `${summary.activeCount} فلاتر نشطة` : 'الشهر الحالي'}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-muted-foreground" aria-live="polite">
              {summary.label}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 min-h-11 w-full justify-center"
          aria-expanded={isMobileOpen}
          aria-controls="reports-mobile-filters"
          onClick={() => setIsMobileOpen(true)}
        >
          <SlidersHorizontal className="me-2 size-4" aria-hidden="true" />
          تعديل الفلاتر
        </Button>
      </section>

      <BottomSheet
        open={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        title="فلترة نطاق التقرير"
      >
        <div id="reports-mobile-filters" className="space-y-4">
          {filtersPanel}
          <div className="border-t border-border/60 pt-4">
            <Button type="button" className="min-h-11 w-full" onClick={() => setIsMobileOpen(false)}>
              <Check className="me-2 size-4" aria-hidden="true" />
              عرض النتائج
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
