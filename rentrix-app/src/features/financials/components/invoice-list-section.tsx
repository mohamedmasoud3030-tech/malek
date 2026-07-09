import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSafeRemainingAmount } from '../financialMath';
import { getInvoiceGrossAmount, type InvoiceListItem, type InvoiceStatusFilter, type InvoiceSummary } from '../invoices/invoiceService';
import { formatDate, formatInvoiceStatusLabel, formatMoney, getErrorMessage } from './financials-formatters';
import { InvoiceFilters } from './invoice-filters';
import { InvoiceSummaryCards } from './invoice-summary-cards';

type InvoiceListSectionProps = {
  summary: InvoiceSummary;
  status: InvoiceStatusFilter;
  invoiceSearch: string;
  invoices: InvoiceListItem[];
  selectedInvoiceId: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isGenerating: boolean;
  canGenerateInvoices: boolean;
  hasInvoiceFilter: boolean;
  onStatusChange: (status: InvoiceStatusFilter) => void;
  onInvoiceSearchChange: (search: string) => void;
  onGenerateInvoices: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  onPrintInvoice?: (invoiceId: string) => void;
  onExportInvoice?: (invoiceId: string) => void;
};

export function InvoiceListSection({
  summary,
  status,
  invoiceSearch,
  invoices,
  selectedInvoiceId,
  isLoading,
  isError,
  error,
  isGenerating,
  canGenerateInvoices,
  hasInvoiceFilter,
  onStatusChange,
  onInvoiceSearchChange,
  onGenerateInvoices,
  onSelectInvoice,
  onPrintInvoice,
  onExportInvoice,
}: InvoiceListSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الفواتير</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InvoiceSummaryCards summary={summary} />

        <InvoiceFilters
          status={status}
          invoiceSearch={invoiceSearch}
          isGenerating={isGenerating}
          canGenerateInvoices={canGenerateInvoices}
          onStatusChange={onStatusChange}
          onInvoiceSearchChange={onInvoiceSearchChange}
          onGenerateInvoices={onGenerateInvoices}
        />

        <div className="space-y-2">
          {isLoading ? <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground" role="status" aria-live="polite">جارٍ تحميل الفواتير...</div> : null}
          {isError ? <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-destructive" role="alert" aria-live="assertive">{getErrorMessage(error, 'تعذر تحميل الفواتير')}</div> : null}
          {!isLoading && !isError && invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
              {hasInvoiceFilter ? 'لا توجد فواتير مطابقة للبحث أو الفلتر الحالي' : 'لا توجد فواتير حتى الآن'}
            </div>
          ) : null}
          {!isLoading && !isError && invoices.map((invoice) => {
            const grossAmount = getInvoiceGrossAmount(invoice);
            const rowRemaining = getSafeRemainingAmount(grossAmount, invoice.paid_amount);
            const isSelected = selectedInvoiceId === invoice.id;
            return (
              <div
                key={invoice.id}
                className={cn(
                  'flex flex-col gap-3 rounded-2xl border p-4 transition',
                  isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'bg-background hover:border-primary/60 hover:bg-muted/40',
                )}
              >
                <button
                  className="w-full text-start grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]"
                  onClick={() => onSelectInvoice(invoice.id)}
                  aria-pressed={isSelected}
                  aria-label={`عرض تفاصيل الفاتورة ${invoice.id.slice(0, 8)}`}
                >
                  <span>
                    <span className="block text-xs text-muted-foreground">رقم الفاتورة</span>
                    <span className="font-black">#{invoice.id.slice(0, 8)}</span>
                  </span>
                  <span>
                    <span className="block text-xs text-muted-foreground">تاريخ الاستحقاق</span>
                    <span>{formatDate(invoice.due_date)}</span>
                  </span>
                  <span>
                    <span className="block text-xs text-muted-foreground">الإجمالي شامل VAT</span>
                    <span>{formatMoney(grossAmount)}</span>
                    {invoice.tax_amount ? <span className="block text-[11px] text-muted-foreground">VAT {formatMoney(invoice.tax_amount)}</span> : null}
                  </span>
                  <span>
                    <span className="block text-xs text-muted-foreground">المدفوع</span>
                    <span>{formatMoney(invoice.paid_amount)}</span>
                  </span>
                  <span>
                    <span className="block text-xs text-muted-foreground">المتبقي</span>
                    <span>{formatMoney(rowRemaining)}</span>
                  </span>
                  <span className="inline-flex h-fit rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                    {formatInvoiceStatusLabel(invoice.status)}
                  </span>
                </button>

                {(onPrintInvoice || onExportInvoice) && (
                  <div className="flex gap-2 border-t pt-2">
                    {onPrintInvoice && (
                      <Button
                        variant="outline"
                        className="h-8"
                        onClick={() => onPrintInvoice(invoice.id)}
                        title="طباعة الفاتورة"
                      >
                        <Printer className="size-4 me-1" />
                        طباعة
                      </Button>
                    )}
                    {onExportInvoice && (
                      <Button
                        variant="outline"
                        className="h-8"
                        onClick={() => onExportInvoice(invoice.id)}
                        title="تنزيل PDF"
                      >
                        <Download className="size-4 me-1" />
                        PDF
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
