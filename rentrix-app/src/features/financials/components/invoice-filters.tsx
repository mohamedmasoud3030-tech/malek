import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { FilterBar } from '@/components/ui/filter-bar';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import type { InvoiceStatusFilter } from '../invoices/invoiceService';

export const invoiceStatusFilters: { value: InvoiceStatusFilter; label: string }[] = [
  { value: 'unpaid', label: 'غير مدفوعة' },
  { value: 'overdue', label: 'متأخرة' },
  { value: 'partial', label: 'مدفوعة جزئياً' },
  { value: 'paid', label: 'مدفوعة' },
  { value: 'all', label: 'الكل' },
];

export type InvoiceFilterOption = { id: string; label: string };

type InvoiceFiltersProps = {
  status: InvoiceStatusFilter;
  invoiceSearch: string;
  isGenerating: boolean;
  canGenerateInvoices: boolean;
  dateFrom: string;
  dateTo: string;
  tenantId: string;
  propertyId: string;
  tenantOptions: InvoiceFilterOption[];
  propertyOptions: InvoiceFilterOption[];
  onStatusChange: (status: InvoiceStatusFilter) => void;
  onInvoiceSearchChange: (search: string) => void;
  onGenerateInvoices: () => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onTenantChange: (value: string) => void;
  onPropertyChange: (value: string) => void;
};

export function InvoiceFilters({
  status,
  invoiceSearch,
  isGenerating,
  canGenerateInvoices,
  dateFrom,
  dateTo,
  tenantId,
  propertyId,
  tenantOptions,
  propertyOptions,
  onStatusChange,
  onInvoiceSearchChange,
  onGenerateInvoices,
  onDateFromChange,
  onDateToChange,
  onTenantChange,
  onPropertyChange,
}: InvoiceFiltersProps) {
  const activeFilters: ActiveFilterItem[] = [];
  const tenantLabel = tenantOptions.find((option) => option.id === tenantId)?.label ?? tenantId;
  const propertyLabel = propertyOptions.find((option) => option.id === propertyId)?.label ?? propertyId;

  if (dateFrom) {
    activeFilters.push({ key: 'dateFrom', label: 'من', value: dateFrom, onRemove: () => onDateFromChange('') });
  }
  if (dateTo) {
    activeFilters.push({ key: 'dateTo', label: 'إلى', value: dateTo, onRemove: () => onDateToChange('') });
  }
  if (tenantId) {
    activeFilters.push({ key: 'tenantId', label: 'المستأجر', value: tenantLabel, onRemove: () => onTenantChange('') });
  }
  if (propertyId) {
    activeFilters.push({ key: 'propertyId', label: 'العقار', value: propertyLabel, onRemove: () => onPropertyChange('') });
  }

  const clearAdvancedFilters = () => {
    onDateFromChange('');
    onDateToChange('');
    onTenantChange('');
    onPropertyChange('');
  };

  const advancedFilters = (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <EntityForm.Field label="من تاريخ الإصدار">
        <Input
          type="date"
          aria-label="من تاريخ الإصدار"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </EntityForm.Field>
      <EntityForm.Field label="إلى تاريخ الإصدار">
        <Input
          type="date"
          aria-label="إلى تاريخ الإصدار"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </EntityForm.Field>
      <EntityForm.Field label="المستأجر">
        <Select aria-label="تصفية حسب المستأجر" value={tenantId} onChange={(event) => onTenantChange(event.target.value)}>
          <option value="">كل المستأجرين</option>
          {tenantOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>
      </EntityForm.Field>
      <EntityForm.Field label="العقار">
        <Select aria-label="تصفية حسب العقار" value={propertyId} onChange={(event) => onPropertyChange(event.target.value)}>
          <option value="">كل العقارات</option>
          {propertyOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>
      </EntityForm.Field>
    </div>
  );

  return (
    <FilterBar
      searchValue={invoiceSearch}
      onSearchChange={onInvoiceSearchChange}
      searchPlaceholder="ابحث برقم الفاتورة، المستأجر، الهاتف، العقار أو الوحدة"
      searchAriaLabel="بحث الفواتير"
      filters={(
        <FilterTabs
          options={invoiceStatusFilters}
          value={status}
          onChange={onStatusChange}
          ariaLabel="حالات الفواتير"
          tone="finance"
        />
      )}
      advancedFilters={advancedFilters}
      advancedFilterTitle="فلاتر الفواتير"
      advancedFilterDescription="ضيّق سجل الفواتير بتاريخ الإصدار أو المستأجر أو العقار. نفس الفلاتر تعمل على الهاتف وسطح المكتب."
      activeFilters={activeFilters}
      onClearAllFilters={clearAdvancedFilters}
      actions={(
        <Button
          className="min-h-11 shrink-0 rounded-lg"
          onClick={onGenerateInvoices}
          disabled={!canGenerateInvoices || isGenerating}
          title={canGenerateInvoices ? undefined : 'ليس لديك صلاحية إنشاء الفواتير'}
          aria-label="إنشاء الفواتير المستحقة"
        >
          {isGenerating ? 'جارٍ الإنشاء...' : 'إنشاء المستحق'}
        </Button>
      )}
    />
  );
}
