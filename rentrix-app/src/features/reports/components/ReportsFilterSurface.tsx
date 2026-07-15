import { useMemo, useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { buildReportFilterSummary } from '../reports-filter-summary';
import { getCurrentMonthFilters, type FilterState } from '../reports-page.helpers';
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
  const selectedCostCenter = costCenterRows.find((row) => row.id === filters.costCenterId)?.name;
  const selectedOwner = ownerRows.find((row) => row.id === filters.ownerId);
  const selectedContract = contractRows.find((row) => row.id === filters.contractId);
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
      <Card className="hidden overflow-hidden border-primary/10 md:block">
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/25 px-4 py-4 sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black sm:text-base">فلترة نطاق التقرير</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">
              حدد الفترة أو المالك أو العقد ثم راجع النتائج في القسم المطلوب.
            </p>
          </div>
        </div>
        <CardContent className="p-3 sm:p-5">{filtersPanel}</CardContent>
      </Card>

      <section className="rounded-2xl border border-border/70 bg-card p-3 md:hidden" aria-label="فلاتر التقارير">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black">نطاق التقرير</h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-black text-muted-foreground">
                {summary.activeCount > 0 ? `${summary.activeCount} فلاتر نشطة` : 'الشهر الحالي'}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-muted-foreground" aria-live="polite">
              {summary.label}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full justify-center"
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
            <Button type="button" className="w-full" onClick={() => setIsMobileOpen(false)}>
              <Check className="me-2 size-4" aria-hidden="true" />
              عرض النتائج
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
