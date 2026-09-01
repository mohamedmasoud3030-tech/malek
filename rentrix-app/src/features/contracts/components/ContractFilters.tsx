import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { FilterBar } from '@/components/ui/filter-bar';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { contractStatusValues } from '../contractSchema';
import type { LeaseModeFilter } from '../hooks/useContractFilters';
import type { ContractStatusFilter } from '../services/contractService';

export const contractStatusFilterLabels: Record<ContractStatusFilter, string> = {
  all: 'الكل',
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  terminated: 'ملغي',
};

export const contractLeaseModeOptions: { value: LeaseModeFilter; label: string }[] = [
  { value: 'all', label: 'كل الإيجارات' },
  { value: 'long_term', label: 'طويل' },
  { value: 'short_stay', label: 'إقامة قصيرة' },
];

export function ContractFilters({
  activeFilters,
  canExport,
  columnVisibilityControl,
  expiringOnly,
  leaseMode,
  onClearAllFilters,
  onExportCsv,
  onExportXlsx,
  exportDisabled = false,
  searchTerm,
  setExpiringOnly,
  setLeaseMode,
  setSearchTerm,
  setStatus,
  status,
}: {
  activeFilters: ActiveFilterItem[];
  canExport: boolean;
  columnVisibilityControl?: ReactNode;
  expiringOnly: boolean;
  leaseMode: LeaseModeFilter;
  onClearAllFilters: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  exportDisabled?: boolean;
  searchTerm: string;
  setExpiringOnly: (updater: (value: boolean) => boolean) => void;
  setLeaseMode: (value: LeaseModeFilter) => void;
  setSearchTerm: (value: string) => void;
  setStatus: (value: ContractStatusFilter) => void;
  status: ContractStatusFilter;
}) {
  const filterOptions = (['all', ...contractStatusValues] as ContractStatusFilter[]).map((filter) => ({
    value: filter,
    label: contractStatusFilterLabels[filter],
  }));

  return (
    <FilterBar
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="بحث باسم المستأجر، الوحدة، العقار، أو رقم العقد"
      searchAriaLabel="بحث في العقود"
      filters={(
        <FilterTabs options={contractLeaseModeOptions} value={leaseMode} onChange={setLeaseMode} tone="contracts" />
      )}
      advancedFilters={(
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" data-contract-advanced-filters>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-black text-muted-foreground">حالة العقد</p>
            <FilterTabs options={filterOptions} value={status} onChange={setStatus} tone="contracts" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-black text-muted-foreground">قرب الانتهاء</p>
            <Button
              variant={expiringOnly ? 'primary' : 'secondary'}
              onClick={() => setExpiringOnly((value) => !value)}
              className="min-h-11 shrink-0 rounded-lg px-3 text-xs"
            >
              <AlertTriangle className="me-1.5 size-3.5" />
              تنتهي خلال 30 يوم
            </Button>
          </div>
        </div>
      )}
      advancedFilterTitle="فلاتر العقود"
      advancedFilterDescription="ابدأ بالبحث ونوع الإيجار. افتح هذه الفلاتر عند الحاجة لتقييد الحالة أو العقود القريبة من الانتهاء."
      activeFilters={activeFilters}
      onClearAllFilters={onClearAllFilters}
      actions={canExport || columnVisibilityControl ? (
        <>
          {columnVisibilityControl ? (
            <div className="hidden min-w-0 items-center gap-2 md:flex" data-contract-columns-control>
              {columnVisibilityControl}
            </div>
          ) : null}
          {canExport ? (
            <ExportMenu
              disabled={exportDisabled}
              items={[
                { id: 'xlsx', label: 'ملف Excel', icon: FileSpreadsheet, onClick: onExportXlsx },
                { id: 'csv', label: 'ملف CSV', icon: FileText, onClick: onExportCsv },
              ]}
            />
          ) : null}
        </>
      ) : undefined}
    />
  );
}
