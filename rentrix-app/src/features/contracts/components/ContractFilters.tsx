import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { contractStatusValues } from '../contractSchema';
import type { LeaseModeFilter } from '../hooks/useContractFilters';
import type { ContractStatusFilter } from '../services/contractService';

const filterLabels: Record<ContractStatusFilter, string> = {
  all: 'الكل',
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  terminated: 'ملغي',
};

const leaseModeOptions: ReadonlyArray<{ value: LeaseModeFilter; label: string }> = [
  { value: 'all', label: 'كل الإيجارات' },
  { value: 'long_term', label: 'طويل' },
  { value: 'short_stay', label: 'إقامة قصيرة' },
];

export function ContractFilters({
  expiringOnly,
  hasActiveFilters,
  leaseMode,
  resetFilters,
  searchTerm,
  setExpiringOnly,
  setLeaseMode,
  setSearchTerm,
  setStatus,
  status,
}: {
  expiringOnly: boolean;
  hasActiveFilters: boolean;
  leaseMode: LeaseModeFilter;
  resetFilters: () => void;
  searchTerm: string;
  setExpiringOnly: (updater: (value: boolean) => boolean) => void;
  setLeaseMode: (value: LeaseModeFilter) => void;
  setSearchTerm: (value: string) => void;
  setStatus: (value: ContractStatusFilter) => void;
  status: ContractStatusFilter;
}) {
  const filterOptions = (['all', ...contractStatusValues] as ContractStatusFilter[]).map((filter) => ({
    value: filter,
    label: filterLabels[filter],
  }));

  return (
    <FilterBar
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="بحث باسم المستأجر، الوحدة، العقار، أو رقم العقد"
      searchAriaLabel="بحث في العقود"
      filters={(
        <>
          <FilterTabs options={leaseModeOptions} value={leaseMode} onChange={setLeaseMode} tone="contracts" />
          <FilterTabs options={filterOptions} value={status} onChange={setStatus} tone="contracts" />
          <Button
            variant={expiringOnly ? 'primary' : 'secondary'}
            onClick={() => setExpiringOnly((value) => !value)}
            className="min-h-11 shrink-0 rounded-lg px-3 text-xs"
          >
            <AlertTriangle className="me-1.5 size-3.5" />
            تنتهي خلال 30 يوم
          </Button>
        </>
      )}
      actions={hasActiveFilters ? (
        <Button variant="ghost" className="min-h-11 shrink-0 rounded-lg px-3 text-xs" onClick={resetFilters}>
          مسح الفلاتر
        </Button>
      ) : undefined}
    />
  );
}
