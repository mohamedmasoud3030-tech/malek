import { Button } from '@/components/ui/button';
import type { InvoiceStatusFilter } from '../invoices/invoiceService';

export const invoiceStatusFilters: { value: InvoiceStatusFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'unpaid', label: 'غير مدفوعة' },
  { value: 'partial', label: 'مدفوعة جزئياً' },
  { value: 'overdue', label: 'متأخرة' },
  { value: 'paid', label: 'مدفوعة' },
];

type InvoiceFiltersProps = {
  status: InvoiceStatusFilter;
  invoiceSearch: string;
  isGenerating: boolean;
  canGenerateInvoices: boolean;
  onStatusChange: (status: InvoiceStatusFilter) => void;
  onInvoiceSearchChange: (search: string) => void;
  onGenerateInvoices: () => void;
};

export function InvoiceFilters({
  status,
  invoiceSearch,
  isGenerating,
  canGenerateInvoices,
  onStatusChange,
  onInvoiceSearchChange,
  onGenerateInvoices,
}: InvoiceFiltersProps) {
  return (
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
  );
}
