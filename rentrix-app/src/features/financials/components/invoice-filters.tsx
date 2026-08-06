import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
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
  const [isComplexFilterOpen, setIsComplexFilterOpen] = useState(false);
  const hasComplexFilters = Boolean(dateFrom || dateTo || tenantId || propertyId);

  const complexFiltersContent = (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
        من تاريخ الإصدار
        <input
          type="date"
          className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="من تاريخ الإصدار"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
        إلى تاريخ الإصدار
        <input
          type="date"
          className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="إلى تاريخ الإصدار"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
        المستأجر
        <select
          className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="تصفية حسب المستأجر"
          value={tenantId}
          onChange={(event) => onTenantChange(event.target.value)}
        >
          <option value="">كل المستأجرين</option>
          {tenantOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
        العقار
        <select
          className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="تصفية حسب العقار"
          value={propertyId}
          onChange={(event) => onPropertyChange(event.target.value)}
        >
          <option value="">كل العقارات</option>
          {propertyOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <div className="space-y-3" data-finance-filter-bar>
      {/* Primary status filters + search + generate — always visible */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="حالات الفواتير">
          {invoiceStatusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={status === filter.value ? 'primary' : 'secondary'}
              className="min-h-11 min-w-11 rounded-xl text-xs font-bold"
              role="tab"
              aria-selected={status === filter.value}
              onClick={() => onStatusChange(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="بحث الفواتير"
              placeholder="ابحث برقم الفاتورة أو الحالة"
              value={invoiceSearch}
              onChange={(event) => onInvoiceSearchChange(event.target.value)}
            />
            <Button
              variant="secondary"
              className="min-h-11 rounded-xl md:hidden"
              aria-label="فلاتر متقدمة"
              onClick={() => setIsComplexFilterOpen(true)}
            >
              <SlidersHorizontal className="me-2 size-4" />
              فلاتر {hasComplexFilters ? `(${[dateFrom, dateTo, tenantId, propertyId].filter(Boolean).length})` : ''}
            </Button>
            {hasComplexFilters ? (
              <Button
                variant="outline"
                className="min-h-11 rounded-xl"
                onClick={() => {
                  onDateFromChange('');
                  onDateToChange('');
                  onTenantChange('');
                  onPropertyChange('');
                }}
                aria-label="مسح الفلاتر المتقدمة"
              >
                <X className="me-1 size-4" />
                مسح
              </Button>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button
              className="min-h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onGenerateInvoices}
              disabled={!canGenerateInvoices || isGenerating}
              title={canGenerateInvoices ? undefined : 'ليس لديك صلاحية توليد الفواتير'}
              aria-label="توليد الفواتير"
            >
              {isGenerating ? 'جارٍ التوليد...' : 'توليد الفواتير'}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: inline complex filters */}
      <div className="hidden rounded-xl border border-border/60 bg-muted/20 p-3 md:block">
        <p className="mb-2 text-xs font-bold text-muted-foreground">فلاتر متقدمة — محفوظة أثناء التنقل والتفصيل</p>
        {complexFiltersContent}
      </div>

      {/* Mobile: bottom sheet for complex filters */}
      <BottomSheet open={isComplexFilterOpen} onClose={() => setIsComplexFilterOpen(false)} title="فلاتر الفواتير المتقدمة">
        <div className="space-y-4">
          <p className="text-xs leading-5 text-muted-foreground">
            الفلاتر محفوظة أثناء drill-down والعودة للسياق السابق. الأرقام تظهر كجزر LTR داخل RTL.
          </p>
          {complexFiltersContent}
          <Button className="min-h-11 w-full rounded-xl bg-primary text-primary-foreground" onClick={() => setIsComplexFilterOpen(false)}>
            تطبيق الفلاتر
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
