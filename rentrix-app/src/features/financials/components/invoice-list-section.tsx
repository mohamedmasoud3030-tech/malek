import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, HandCoins, Printer, ReceiptText } from 'lucide-react';
import { EntityTable } from '@/components/ui/entity-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { getSafeRemainingAmount } from '../financialMath';
import { isInvoiceCollectible } from '../invoices/quick-collect';
import {
  getInvoiceGrossAmount,
  type InvoiceListItem,
  type InvoiceStatusFilter,
  type InvoiceSummary,
} from '../invoices/invoiceService';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
import { normalizeInvoiceStatus } from './invoice-status-labels';
import { InvoiceFilters, type InvoiceFilterOption } from './invoice-filters';
import { InvoiceSummaryCards } from './invoice-summary-cards';
import { formatLatinNumber } from '@/lib/formatters';
import {
  FinanceSection,
  FinanceCluster,
  FinanceFilterBar,
  FinanceStatusBadge,
  mapInvoiceStatusToFinanceKind,
  FinanceAmount,
} from './finance-reporting-visual-foundations';
import { ActionMenu } from '@/components/ui/action-menu';

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
    <Card className="overflow-hidden" data-component-card>
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4" data-finance-header>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ReceiptText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-sm font-bold">الفواتير</CardTitle>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              عرض واضح للمستحق والمدفوع والمتبقي — مع الحفاظ على الفترة والعقار والمستأجر.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-3 sm:p-5">
        {/* 3. Summary KPIs with drill-down preserving filters */}
        <FinanceSection ariaLabel="ملخص الفواتير">
          <InvoiceSummaryCards
            summary={summary}
            currentFilters={{ dateFrom, dateTo, tenantId, propertyId }}
            onStatusDrill={onStatusChange}
          />
        </FinanceSection>

        {/* 4. Filters and period context — preserved during drill-down */}
        <FinanceSection ariaLabel="فلاتر الفواتير">
          <FinanceFilterBar ariaLabel="فلاتر الفواتير" className="rounded-2xl">
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
          </FinanceFilterBar>
        </FinanceSection>

        {/* 5. Main table/list — desktop stays table, tabular-nums, LTR islands */}
        <FinanceSection ariaLabel="قائمة الفواتير">
          <div data-finance-table-wrapper>
            <EntityTable
              aria-label="جدول الفواتير"
              rows={invoices}
              keyOf={(invoice) => invoice.id}
              isLoading={isLoading}
              error={isError ? error : undefined}
              errorTitle="تعذر تحميل الفواتير"
              emptyTitle={hasInvoiceFilter ? 'لا توجد فواتير مطابقة' : 'لا توجد فواتير حتى الآن'}
              emptyDescription={
                hasInvoiceFilter
                  ? 'لا توجد فواتير مطابقة للبحث أو الفلتر الحالي — جرّب تعديل الفلاتر مع الحفاظ على السياق.'
                  : 'أنشئ فواتير جديدة من الأعلى. لن يظهر خطأ التحميل كحالة فارغة.'
              }
              onRowClick={(invoice) => onSelectInvoice(invoice.id)}
              columns={[
                {
                  key: 'id',
                  header: 'رقم الفاتورة',
                  render: (invoice) => <span className="font-bold tabular-nums">#{invoice.id.slice(0, 8)}</span>,
                },
                {
                  key: 'due_date',
                  header: 'تاريخ الاستحقاق',
                  render: (invoice) => (
                    <span dir="ltr" className="tabular-nums">
                      {formatDate(invoice.due_date)}
                    </span>
                  ),
                },
                {
                  key: 'gross',
                  header: 'الإجمالي شامل VAT',
                  render: (invoice) => {
                    const grossAmount = getInvoiceGrossAmount(invoice);
                    return (
                      <span className="inline-flex flex-col">
                        <FinanceAmount>{formatMoney(grossAmount)}</FinanceAmount>
                        {invoice.tax_amount ? (
                          <span className="text-[11px] text-muted-foreground">
                            VAT <FinanceAmount>{formatMoney(invoice.tax_amount)}</FinanceAmount>
                          </span>
                        ) : null}
                      </span>
                    );
                  },
                },
                {
                  key: 'paid_amount',
                  header: 'المدفوع',
                  render: (invoice) => <FinanceAmount className="text-success">{formatMoney(invoice.paid_amount)}</FinanceAmount>,
                },
                {
                  key: 'remaining',
                  header: 'المتبقي',
                  render: (invoice) => {
                    const grossAmount = getInvoiceGrossAmount(invoice);
                    return (
                      <FinanceAmount className={getSafeRemainingAmount(grossAmount, invoice.paid_amount) > 0 ? 'text-destructive' : 'text-success'}>
                        {formatMoney(getSafeRemainingAmount(grossAmount, invoice.paid_amount))}
                      </FinanceAmount>
                    );
                  },
                },
                {
                  key: 'status',
                  header: 'الحالة',
                  render: (invoice) => {
                    const kind = mapInvoiceStatusToFinanceKind(invoice.status);
                    return (
                      <FinanceStatusBadge kind={kind} label={formatInvoiceStatusLabel(invoice.status)} />
                    );
                  },
                },
                {
                  key: 'actions',
                  header: 'إجراءات',
                  render: (invoice) => {
                    const showCollect = canCollectPayments && onCollectInvoice && isInvoiceCollectible(invoice);
                    if (!showCollect && !onPrintInvoice && !onExportInvoice) return null;
                    return (
                      <div
                        className="flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {showCollect ? (
                          <Button
                            className="h-11 min-w-11 bg-primary text-primary-foreground hover:bg-primary/90"
                            aria-label={`تحصيل فاتورة ${invoice.id.slice(0, 8)}`}
                            onClick={() => onCollectInvoice(invoice.id)}
                            title="تسجيل دفعة على هذه الفاتورة مباشرة"
                          >
                            <HandCoins className="me-1 size-4" />
                            تحصيل
                          </Button>
                        ) : null}
                        {(onPrintInvoice || onExportInvoice) ? (
                          <ActionMenu
                            label="إجراءات إضافية للفاتورة"
                            items={[
                              ...(onPrintInvoice
                                ? [{ id: 'print', label: 'طباعة', icon: Printer, onClick: () => onPrintInvoice(invoice.id) }]
                                : []),
                              ...(onExportInvoice
                                ? [{ id: 'pdf', label: 'PDF', icon: Download, onClick: () => onExportInvoice(invoice.id) }]
                                : []),
                            ]}
                          />
                        ) : null}
                      </div>
                    );
                  },
                },
              ]}
              renderMobileCard={(invoice) => {
                const grossAmount = getInvoiceGrossAmount(invoice);
                const rowRemaining = getSafeRemainingAmount(grossAmount, invoice.paid_amount);
                const isSelected = selectedInvoiceId === invoice.id;
                const kind = mapInvoiceStatusToFinanceKind(invoice.status);
                const showCollect = canCollectPayments && onCollectInvoice && isInvoiceCollectible(invoice);
                return (
                  <div
                    data-finance-mobile-card
                    className={isSelected ? 'ring-2 ring-primary/20' : undefined}
                  >
                    <MobileCard
                      variant={isSelected ? 'elevated' : 'default'}
                      accent={normalizeInvoiceStatus(invoice.status) === 'overdue' ? 'danger' : rowRemaining > 0 ? 'warning' : 'success'}
                      className={isSelected ? 'ring-2 ring-primary/20' : undefined}
                      title={`فاتورة #${invoice.id.slice(0, 8)}`}
                      subtitle={`استحقاق ${formatDate(invoice.due_date)} — المبلغ ${formatMoney(grossAmount)}`}
                      badge={<FinanceStatusBadge kind={kind} label={formatInvoiceStatusLabel(invoice.status)} />}
                      onClick={() => onSelectInvoice(invoice.id)}
                      stats={
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-muted/50 p-2">
                            <p className="text-[10px] font-bold text-muted-foreground">الإجمالي</p>
                            <p className="mt-1 text-sm font-black tabular-nums" dir="ltr">
                              {formatMoney(grossAmount)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-2">
                            <p className="text-[10px] font-bold text-muted-foreground">المدفوع</p>
                            <p className="mt-1 text-sm font-black text-success tabular-nums" dir="ltr">
                              {formatMoney(invoice.paid_amount)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-2">
                            <p className="text-[10px] font-bold text-muted-foreground">المتبقي</p>
                            <p className="mt-1 text-sm font-black text-destructive tabular-nums" dir="ltr">
                              {formatMoney(rowRemaining)}
                            </p>
                          </div>
                        </div>
                      }
                      footer={
                        invoice.tax_amount
                          ? `ضريبة القيمة المضافة: ${formatMoney(invoice.tax_amount)}`
                          : `الحالة: ${formatInvoiceStatusLabel(invoice.status)} — اضغط لفتح التفاصيل الكاملة`
                      }
                      actions={
                        (showCollect || onPrintInvoice || onExportInvoice) ? (
                          <div className="flex w-full flex-col gap-2">
                            {showCollect ? (
                              <Button
                                className="min-h-11 w-full rounded-xl bg-primary text-primary-foreground"
                                onClick={() => onCollectInvoice(invoice.id)}
                              >
                                <HandCoins className="me-1 size-4" />
                                تحصيل الفاتورة
                              </Button>
                            ) : null}
                            <div className="grid w-full grid-cols-2 gap-2">
                              {onPrintInvoice && (
                                <Button
                                  variant="secondary"
                                  className="min-h-11 rounded-xl"
                                  onClick={() => onPrintInvoice(invoice.id)}
                                >
                                  <Printer className="me-1 size-4" />
                                  طباعة
                                </Button>
                              )}
                              {onExportInvoice && (
                                <Button
                                  variant="secondary"
                                  className="min-h-11 rounded-xl"
                                  onClick={() => onExportInvoice(invoice.id)}
                                >
                                  <Download className="me-1 size-4" />
                                  PDF
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : undefined
                      }
                    />
                  </div>
                );
              }}
            />
          </div>

          <FinanceCluster>
            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold text-muted-foreground" aria-live="polite" dir="ltr">
                إجمالي {formatLatinNumber(total, 'ar')} فاتورة · صفحة {formatLatinNumber(page, 'ar')} من{' '}
                {formatLatinNumber(totalPages, 'ar')} — الفلاتر محفوظة أثناء التنقل
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  variant="outline"
                  className="min-h-11 rounded-xl"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  aria-label="الصفحة السابقة"
                >
                  السابق
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-xl"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                  aria-label="الصفحة التالية"
                >
                  التالي
                </Button>
              </div>
            </div>
          </FinanceCluster>
        </FinanceSection>
      </CardContent>
    </Card>
  );
}
