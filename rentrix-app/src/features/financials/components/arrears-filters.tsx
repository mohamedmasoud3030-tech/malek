import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { arrearsBucketOptions, type ArrearsBucketFilter } from './arrears-workflow-helpers';

type ArrearsFiltersProps = Readonly<{
  asOf: string;
  search: string;
  bucketFilter: ArrearsBucketFilter;
  onAsOfChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onBucketFilterChange: (value: ArrearsBucketFilter) => void;
}>;

export function ArrearsFilters({
  asOf,
  search,
  bucketFilter,
  onAsOfChange,
  onSearchChange,
  onBucketFilterChange,
}: ArrearsFiltersProps) {
  return (
    <FilterBar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="رقم الفاتورة أو المستأجر أو العقار أو الوحدة أو العقد"
      searchAriaLabel="بحث في المتأخرات"
      filters={(
        <>
          <label className="grid min-w-0 gap-1 text-sm font-bold">
            <span className="sr-only">حتى تاريخ</span>
            <Input aria-label="حتى تاريخ" type="date" value={asOf} onChange={(event) => onAsOfChange(event.target.value)} />
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-bold">
            <span className="sr-only">فئة العمر</span>
            <Select aria-label="فئة عمر المتأخرات" value={bucketFilter} onChange={(event) => onBucketFilterChange(event.currentTarget.value as ArrearsBucketFilter)}>
              {arrearsBucketOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
        </>
      )}
    />
  );
}
