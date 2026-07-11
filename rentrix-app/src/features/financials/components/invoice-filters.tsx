import { Button } from '@/components/ui/button';
import type { InvoiceStatusFilter } from '../invoices/invoiceService';

export const invoiceStatusFilters: { value: InvoiceStatusFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'unpaid', label: 'غير مدفوعة' },
  { value: 'partial', label: 'مدفوعة جزئياً' },
  { value: 'overdue', label: 'متأخرة' },
  { value: 'paid', label: 'مدفوعة' },
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
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {invoiceStatusFilters.map((filter) => (
            <Button key={filter.value} variant={status === filter.value ? 'primary' : 'secondary'} onClick={() => onStatusChange(filter.value)}>
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="min-h-12 rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label="بحث الفواتير"
            placeholder="ابحث برقم الفاتورة أو الحالة"
            value={invoiceSearch}
            onChange={(event) => onInvoiceSearchChange(event.target.value)}
          />
          <Button className="min-h-12" onClick={onGenerateInvoices} disabled={!canGenerateInvoices || isGenerating} title={canGenerateInvoices ? undefined : 'ليس لديك صلاحية توليد الفواتير'}>
            {isGenerating ? 'جارٍ التوليد...' : 'توليد الفواتير'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          من تاريخ الإصدار
          <input
            type="date"
            className="min-h-10 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label="من تاريخ الإصدار"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          إلى تاريخ الإصدار
          <input
            type="date"
            className="min-h-10 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label="إلى تاريخ الإصدار"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          المستأجر
          <select
            className="min-h-10 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label="تصفية حسب المستأجر"
            value={tenantId}
            onChange={(event) => onTenantChange(event.target.value)}
          >
            <option value="">كل المستأجرين</option>
            {tenantOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          العقار
          <select
            className="min-h-10 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label="تصفية حسب العقار"
            value={propertyId}
            onChange={(event) => onPropertyChange(event.target.value)}
          >
            <option value="">كل العقارات</option>
            {propertyOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
