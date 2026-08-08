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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <FilterTabs options={filterOptions} value={status} onChange={setStatus} tone="contracts" />
        <Button
          variant={expiringOnly ? 'primary' : 'secondary'}
          onClick={() => setExpiringOnly((value) => !value)}
          className="shrink-0"
        >
          <AlertTriangle className="me-2 size-4" />
          تنتهي خلال 30 يوم
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={resetFilters}>مسح الفلاتر</Button>
        )}
      </div>
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="بحث باسم المستأجر، الوحدة، العقار، أو رقم العقد"
        className="w-full lg:max-w-md"
      />
    </div>
  );
}
