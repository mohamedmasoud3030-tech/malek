import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchInput } from '@/components/ui/search-input';
import { contractStatusValues } from '../contractSchema';
import type { ContractStatusFilter } from '../services/contractService';

const filterLabels: Record<ContractStatusFilter, string> = {
  all: 'الكل',
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  terminated: 'ملغي',
};

export function ContractFilters({
  expiringOnly,
  hasActiveFilters,
  resetFilters,
  searchTerm,
  setExpiringOnly,
  setSearchTerm,
  setStatus,
  status,
}: {
  expiringOnly: boolean;
  hasActiveFilters: boolean;
  resetFilters: () => void;
  searchTerm: string;
  setExpiringOnly: (updater: (value: boolean) => boolean) => void;
  setSearchTerm: (value: string) => void;
  setStatus: (value: ContractStatusFilter) => void;
  status: ContractStatusFilter;
}) {
  const filterOptions = (['all', ...contractStatusValues] as ContractStatusFilter[]).map((filter) => ({
    value: filter,
    label: filterLabels[filter],
  }));

  return (
    <div className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center">
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="بحث باسم المستأجر، الوحدة، العقار، أو رقم العقد"
        className="w-full lg:max-w-xl lg:flex-1"
      />

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar">
        <FilterTabs options={filterOptions} value={status} onChange={setStatus} tone="contracts" />
        <Button
          variant={expiringOnly ? 'primary' : 'secondary'}
          onClick={() => setExpiringOnly((value) => !value)}
          className="min-h-11 shrink-0 rounded-lg px-3 text-xs"
        >
          <AlertTriangle className="me-1.5 size-3.5" />
          تنتهي خلال 30 يوم
        </Button>
        {hasActiveFilters ? (
          <Button variant="ghost" className="min-h-11 shrink-0 rounded-lg px-3 text-xs" onClick={resetFilters}>
            مسح الفلاتر
          </Button>
        ) : null}
      </div>
    </div>
  );
}
