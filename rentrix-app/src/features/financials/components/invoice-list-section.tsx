import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { EntityTable } from '@/components/ui/entity-table';
import { getSafeRemainingAmount } from '../financialMath';
import { getInvoiceGrossAmount, type InvoiceListItem, type InvoiceStatusFilter, type InvoiceSummary } from '../invoices/invoiceService';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
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

        <EntityTable
          aria-label="جدول الفواتير"
          rows={invoices}
          keyOf={(invoice) => invoice.id}
          isLoading={isLoading}
          error={isError ? error : undefined}
          errorTitle="تعذر تحميل الفواتير"
          emptyTitle={hasInvoiceFilter ? 'لا توجد فواتير مطابقة' : 'لا توجد فواتير حتى الآن'}
          emptyDescription={hasInvoiceFilter ? 'لا توجد فواتير مطابقة للبحث أو الفلتر الحالي' : 'أنشئ فواتير جديدة من الأعلى.'}
          onRowClick={(invoice) => onSelectInvoice(invoice.id)}
          columns={[
            { key: 'id', header: 'رقم الفاتورة', render: (invoice) => <span className="font-black">#{invoice.id.slice(0, 8)}</span> },
            { key: 'due_date', header: 'تاريخ الاستحقاق', render: (invoice) => formatDate(invoice.due_date) },
            { key: 'gross', header: 'الإجمالي شامل VAT', render: (invoice) => {
              const grossAmount = getInvoiceGrossAmount(invoice);
              return (
                <span>
                  {formatMoney(grossAmount)}
                  {invoice.tax_amount ? <span className="block text-[11px] text-muted-foreground">VAT {formatMoney(invoice.tax_amount)}</span> : null}
                </span>
              );
            } },
            { key: 'paid_amount', header: 'المدفوع', render: (invoice) => formatMoney(invoice.paid_amount) },
            { key: 'remaining', header: 'المتبقي', render: (invoice) => {
              const grossAmount = getInvoiceGrossAmount(invoice);
              return formatMoney(getSafeRemainingAmount(grossAmount, invoice.paid_amount));
            } },
            { key: 'status', header: 'الحالة', render: (invoice) => (
              <span className="inline-flex h-fit rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                {formatInvoiceStatusLabel(invoice.status)}
              </span>
            ) },
            { key: 'actions', header: 'إجراءات', render: (invoice) => (
              (onPrintInvoice || onExportInvoice) ? (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {onPrintInvoice && (
                    <Button variant="outline" className="h-8" onClick={() => onPrintInvoice(invoice.id)} title="طباعة الفاتورة">
                      <Printer className="size-4 me-1" />طباعة
                    </Button>
                  )}
                  {onExportInvoice && (
                    <Button variant="outline" className="h-8" onClick={() => onExportInvoice(invoice.id)} title="تنزيل PDF">
                      <Download className="size-4 me-1" />PDF
                    </Button>
                  )}
                </div>
              ) : null
            ) },
          ]}
          renderMobileCard={(invoice) => {
            const grossAmount = getInvoiceGrossAmount(invoice);
            const rowRemaining = getSafeRemainingAmount(grossAmount, invoice.paid_amount);
            const isSelected = selectedInvoiceId === invoice.id;
            return (
              <div
                className={`rounded-2xl border bg-background p-4 space-y-3 ${isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : ''}`}
              >
                <button
                  className="w-full text-start grid gap-3 grid-cols-2"
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
                      <Button variant="outline" className="h-8" onClick={() => onPrintInvoice(invoice.id)} title="طباعة الفاتورة">
                        <Printer className="size-4 me-1" />طباعة
                      </Button>
                    )}
                    {onExportInvoice && (
                      <Button variant="outline" className="h-8" onClick={() => onExportInvoice(invoice.id)} title="تنزيل PDF">
                        <Download className="size-4 me-1" />PDF
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
