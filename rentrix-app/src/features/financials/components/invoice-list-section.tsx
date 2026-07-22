import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, HandCoins, Printer, ReceiptText } from 'lucide-react';
import { EntityTable } from '@/components/ui/entity-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getSafeRemainingAmount } from '../financialMath';
import { isInvoiceCollectible } from '../invoices/quick-collect';
import { getInvoiceGrossAmount, type InvoiceListItem, type InvoiceStatusFilter, type InvoiceSummary } from '../invoices/invoiceService';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
import { normalizeInvoiceStatus } from './invoice-status-labels';
import { InvoiceFilters, type InvoiceFilterOption } from './invoice-filters';
import { InvoiceSummaryCards } from './invoice-summary-cards';

// Keyed by the CANONICAL status — live rows mix lowercase and UPPERCASE raw values.
const invoiceStatusTone = {
  paid: 'green',
  partial: 'gold',
  overdue: 'red',
  unpaid: 'blue',
  cancelled: 'gray',
  draft: 'gray',
  void: 'gray',
  other: 'gray',
} as const;

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
  dateFrom: string;
  dateTo: string;
  tenantId: string;
  propertyId: string;
  tenantOptions: InvoiceFilterOption[];
  propertyOptions: InvoiceFilterOption[];
  page: number;
  pageSize: number;
  total: number;
  onStatusChange: (status: InvoiceStatusFilter) => void;
  onInvoiceSearchChange: (search: string) => void;
  onGenerateInvoices: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  /** Permission-gated «تحصيل» quick-collect action on collectible rows. */
  canCollectPayments?: boolean;
  onCollectInvoice?: (invoiceId: string) => void;
  onPrintInvoice?: (invoiceId: string) => void;
  onExportInvoice?: (invoiceId: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onTenantChange: (value: string) => void;
  onPropertyChange: (value: string) => void;
  onPageChange: (page: number) => void;
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
  dateFrom,
  dateTo,
  tenantId,
  propertyId,
  tenantOptions,
  propertyOptions,
  page,
  pageSize,
  total,
  onStatusChange,
  onInvoiceSearchChange,
  onGenerateInvoices,
  onSelectInvoice,
  canCollectPayments = false,
  onCollectInvoice,
  onPrintInvoice,
  onExportInvoice,
  onDateFromChange,
  onDateToChange,
  onTenantChange,
  onPropertyChange,
  onPageChange,
}: InvoiceListSectionProps) {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ReceiptText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>الفواتير</CardTitle>
            <p className="mt-1 text-xs font-bold text-muted-foreground">عرض واضح للمستحق والمدفوع والمتبقي من مكان واحد.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-3 sm:p-6">
        <InvoiceSummaryCards summary={summary} />

        <div className="rounded-3xl border border-border/70 bg-muted/20 p-3 sm:p-4">
          <InvoiceFilters
            status={status}
            invoiceSearch={invoiceSearch}
            isGenerating={isGenerating}
            canGenerateInvoices={canGenerateInvoices}
            dateFrom={dateFrom}
            dateTo={dateTo}
            tenantId={tenantId}
            propertyId={propertyId}
            tenantOptions={tenantOptions}
            propertyOptions={propertyOptions}
            onStatusChange={onStatusChange}
            onInvoiceSearchChange={onInvoiceSearchChange}
            onGenerateInvoices={onGenerateInvoices}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
            onTenantChange={onTenantChange}
            onPropertyChange={onPropertyChange}
          />
        </div>

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
              <StatusBadge tone={invoiceStatusTone[normalizeInvoiceStatus(invoice.status)]}>
                {formatInvoiceStatusLabel(invoice.status)}
              </StatusBadge>
            ) },
            { key: 'actions', header: 'إجراءات', render: (invoice) => {
              const showCollect = canCollectPayments && onCollectInvoice && isInvoiceCollectible(invoice);
              if (!showCollect && !onPrintInvoice && !onExportInvoice) return null;
              return (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  {showCollect ? (
                    <Button className="h-8" onClick={() => onCollectInvoice(invoice.id)} title="تسجيل دفعة على هذه الفاتورة مباشرة">
                      <HandCoins className="me-1 size-4" />تحصيل
                    </Button>
                  ) : null}
                  {onPrintInvoice && (
                    <Button variant="outline" className="h-8" onClick={() => onPrintInvoice(invoice.id)} title="طباعة الفاتورة">
                      <Printer className="me-1 size-4" />طباعة
                    </Button>
                  )}
                  {onExportInvoice && (
                    <Button variant="outline" className="h-8" onClick={() => onExportInvoice(invoice.id)} title="تنزيل PDF">
                      <Download className="me-1 size-4" />PDF
                    </Button>
                  )}
                </div>
              );
            } },
          ]}
          renderMobileCard={(invoice) => {
            const grossAmount = getInvoiceGrossAmount(invoice);
            const rowRemaining = getSafeRemainingAmount(grossAmount, invoice.paid_amount);
            const isSelected = selectedInvoiceId === invoice.id;
            const tone = invoiceStatusTone[normalizeInvoiceStatus(invoice.status)];
            const showCollect = canCollectPayments && onCollectInvoice && isInvoiceCollectible(invoice);
            return (
              <MobileCard
                variant={isSelected ? 'elevated' : 'default'}
                accent={normalizeInvoiceStatus(invoice.status) === 'overdue' ? 'danger' : rowRemaining > 0 ? 'warning' : 'success'}
                className={isSelected ? 'ring-2 ring-primary/20' : undefined}
                title={`فاتورة #${invoice.id.slice(0, 8)}`}
                subtitle={`استحقاق ${formatDate(invoice.due_date)}`}
                badge={<StatusBadge tone={tone}>{formatInvoiceStatusLabel(invoice.status)}</StatusBadge>}
                onClick={() => onSelectInvoice(invoice.id)}
                stats={(
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted/50 p-2">
                      <p className="text-[10px] font-bold text-muted-foreground">الإجمالي</p>
                      <p className="mt-1 text-sm font-black">{formatMoney(grossAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2">
                      <p className="text-[10px] font-bold text-muted-foreground">المدفوع</p>
                      <p className="mt-1 text-sm font-black text-success">{formatMoney(invoice.paid_amount)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2">
                      <p className="text-[10px] font-bold text-muted-foreground">المتبقي</p>
                      <p className="mt-1 text-sm font-black text-danger">{formatMoney(rowRemaining)}</p>
                    </div>
                  </div>
                )}
                footer={invoice.tax_amount ? `ضريبة القيمة المضافة: ${formatMoney(invoice.tax_amount)}` : undefined}
                actions={(showCollect || onPrintInvoice || onExportInvoice) ? (
                  <div className="flex w-full flex-col gap-2">
                    {showCollect ? (
                      <Button className="min-h-11 w-full rounded-xl text-xs" onClick={() => onCollectInvoice(invoice.id)}>
                        <HandCoins className="me-1 size-4" />تحصيل الفاتورة
                      </Button>
                    ) : null}
                    {(onPrintInvoice || onExportInvoice) ? (
                      <div className="grid w-full grid-cols-2 gap-2">
                        {onPrintInvoice && (
                          <Button variant="secondary" className="min-h-11 rounded-xl text-xs" onClick={() => onPrintInvoice(invoice.id)}>
                            <Printer className="me-1 size-4" />طباعة
                          </Button>
                        )}
                        {onExportInvoice && (
                          <Button variant="secondary" className="min-h-11 rounded-xl text-xs" onClick={() => onExportInvoice(invoice.id)}>
                            <Download className="me-1 size-4" />PDF
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : undefined}
              />
            );
          }}
        />

        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-muted-foreground" aria-live="polite">
            إجمالي {total.toLocaleString('ar')} فاتورة · صفحة {page.toLocaleString('ar')} من {totalPages.toLocaleString('ar')}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="min-h-11 rounded-xl" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              السابق
            </Button>
            <Button variant="outline" className="min-h-11 rounded-xl" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              التالي
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
