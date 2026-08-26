import { useMemo, useState } from 'react';
import { Building2, CalendarRange, Check, CircleDot, DoorOpen, FileText, Landmark, RotateCcw, SlidersHorizontal, UserRound, UsersRound } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { invoiceStatusLabels } from '@/features/financials/components/invoice-status-labels';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { cn } from '@/lib/utils';
import { buildReportFilterSummary, type ReportFilterChip } from '../reports-filter-summary';
import { getInitialReportsFilters, type ReportsFilterState } from '../reports-workspace-filters';
import { describeReportFilterSelections, getSelectedFilterEntities } from '../reports-filters.shared';
import { FiltersPanel } from './FiltersPanel';

type ReportsFilterSurfaceProps = Readonly<{
  filters: ReportsFilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  onChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>;

const filterChipIcons = {
  period: CalendarRange,
  asOf: CalendarRange,
  property: Building2,
  unit: DoorOpen,
  tenant: UserRound,
  status: CircleDot,
  costCenter: Landmark,
  owner: UsersRound,
  contract: FileText,
} satisfies Record<ReportFilterChip['key'], React.ComponentType<{ className?: string }>>;

export function ReportsFilterSurface({
  filters,
  costCenterRows,
  ownerRows,
  contractRows,
  onChange,
  onResetCurrentMonth,
}: ReportsFilterSurfaceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const defaults = useMemo(() => getInitialReportsFilters(), []);
  const labels = describeReportFilterSelections(
    getSelectedFilterEntities(filters, costCenterRows, ownerRows, contractRows),
  );
  const summary = buildReportFilterSummary(filters, defaults, {
    ...labels,
    status: filters.status && filters.status !== 'all' ? (invoiceStatusLabels[filters.status] ?? filters.status) : undefined,
  });
  const isCurrentPeriod = filters.from === defaults.from && filters.to === defaults.to && filters.asOf === defaults.asOf;
  const visibleChips = summary.chips.filter((chip) => chip.isActive || chip.key === 'period' || chip.key === 'asOf');

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border/65 bg-card shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5 p-2.5 sm:p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-xs font-black sm:text-sm">نطاق التقرير</h2>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-bold',
                summary.activeCount > 0
                  ? 'bg-primary/10 text-info'
                  : 'bg-muted text-muted-foreground',
              )}>
                {summary.activeCount > 0 ? `${summary.activeCount} مخصص` : 'الشهر الحالي'}
              </span>
            </div>
            <p className="mt-0.5 hidden truncate text-[11px] font-medium text-muted-foreground sm:block">
              الفترة والأبعاد المشتركة لكل التقارير
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!isCurrentPeriod ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onResetCurrentMonth}
                aria-label="إعادة نطاق التقرير إلى الشهر الحالي"
                title="الشهر الحالي"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="min-h-11 px-3" onClick={() => setIsOpen(true)}>
              <SlidersHorizontal className="me-1.5 size-4" aria-hidden="true" />
              تعديل النطاق
            </Button>
          </div>
        </div>

        <div
          className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-border/50 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 sm:flex-wrap sm:overflow-visible sm:p-3"
          aria-live="polite"
          tabIndex={0}
          role="region"
          aria-label="ملخص نطاق التقرير الحالي — قابل للتمرير أفقياً على الشاشات الصغيرة"
        >
          {visibleChips.map((chip) => {
            const Icon = filterChipIcons[chip.key];
            return (
              <div
                key={chip.key}
                className={cn(
                  'flex min-w-max items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] sm:text-xs',
                  chip.isActive
                    ? 'border-primary/25 bg-primary/5 text-foreground'
                    : 'border-border/65 bg-muted/20 text-muted-foreground',
                )}
              >
                <Icon className={cn('size-3.5', chip.isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                <span className="font-semibold text-muted-foreground">{chip.label}</span>
                <span className="font-bold" dir={chip.key === 'period' || chip.key === 'asOf' ? 'ltr' : undefined}>{chip.value}</span>
              </div>
            );
          })}
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
              تطبيق وعرض النتائج
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
