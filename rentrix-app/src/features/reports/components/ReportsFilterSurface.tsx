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
import { getSelectedFilterEntities } from '../reports-filters.shared';
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
  const { selectedCostCenter, selectedOwner, selectedContract, selectedProperty, selectedUnit, selectedTenant } = getSelectedFilterEntities(
    filters,
    costCenterRows,
    ownerRows,
    contractRows,
  );
  const summary = buildReportFilterSummary(filters, defaults, {
    property: selectedProperty?.title,
    unit: selectedUnit?.unit_number ? `وحدة ${selectedUnit.unit_number}` : undefined,
    tenant: selectedTenant?.full_name,
    status: filters.status && filters.status !== 'all' ? (invoiceStatusLabels[filters.status] ?? filters.status) : undefined,
    costCenter: selectedCostCenter,
    owner: selectedOwner?.display_name ?? selectedOwner?.full_name,
    contract: selectedContract ? selectedContract.reference || `${selectedContract.people?.full_name ?? 'مستأجر'} — ${selectedContract.properties?.title ?? 'عقار'}` : undefined,
  });

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        <div className="flex min-w-0 flex-col gap-3 border-b border-border/60 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <SlidersHorizontal className="size-[1.125rem]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold">نطاق التقرير</h2>
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-bold',
                  summary.activeCount > 0
                    ? 'bg-primary/10 text-info'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {summary.activeCount > 0 ? `${summary.activeCount} فلاتر مخصصة` : 'الشهر الحالي'}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                الفترة والاحتساب والأبعاد التشغيلية المشتركة؛ يوضح النموذج أين ينطبق كل بُعد.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={onResetCurrentMonth}
              disabled={filters.from === defaults.from && filters.to === defaults.to && filters.asOf === defaults.asOf}
            >
              <RotateCcw className="me-2 size-4" aria-hidden="true" />
              الشهر الحالي
            </Button>
            <Button type="button" className="min-h-11" onClick={() => setIsOpen(true)}>
              <SlidersHorizontal className="me-2 size-4" aria-hidden="true" />
              تعديل النطاق
            </Button>
          </div>
        </div>

        <div
          className="no-scrollbar flex gap-2 overflow-x-auto p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 sm:flex-wrap sm:overflow-visible sm:p-4"
          aria-live="polite"
          tabIndex={0}
          role="region"
          aria-label="ملخص نطاق التقرير الحالي — قابل للتمرير أفقياً على الشاشات الصغيرة"
        >
          {summary.chips.map((chip) => {
            const Icon = filterChipIcons[chip.key];
            return (
              <div
                key={chip.key}
                className={cn(
                  'flex min-w-max items-center gap-2 rounded-xl border px-3 py-2 text-xs',
                  chip.isActive
                    ? 'border-primary/25 bg-primary/5 text-foreground'
                    : 'border-border/70 bg-muted/30 text-muted-foreground',
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
