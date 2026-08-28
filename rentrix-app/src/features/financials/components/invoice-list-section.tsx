import { Button } from '@/components/ui/button';
import { Download, HandCoins, Printer } from 'lucide-react';
import { useState } from 'react';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { EntityTable } from '@/components/ui/entity-table';
import { getSafeRemainingAmount } from '../financialMath';
import { isInvoiceCollectible } from '../invoices/quick-collect';
import {
  getInvoiceGrossAmount,
  type InvoiceListItem,
  type InvoiceStatusFilter,
  type InvoiceSummary,
} from '../invoices/invoiceService';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
import { InvoiceFilters, type InvoiceFilterOption } from './invoice-filters';
import { InvoiceSummaryCards } from './invoice-summary-cards';
import {
  FinanceSection,
  FinanceFilterBar,
  FinanceStatusBadge,
  mapInvoiceStatusToFinanceKind,
  FinanceAmount,
} from './finance-reporting-visual-foundations';
import { ActionMenu } from '@/components/ui/action-menu';

const invoiceColumnOptions = [
  { key: 'id', label: 'رقم الفاتورة', locked: true },
  { key: 'due_date', label: 'تاريخ الاستحقاق' },
  { key: 'gross', label: 'الإجمالي شامل VAT' },
  { key: 'paid_amount', label: 'المدفوع' },
  { key: 'remaining', label: 'المتبقي' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'الإجراءات', locked: true },
] as const;

const defaultInvoiceColumns = invoiceColumnOptions.map((column) => column.key);

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
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultInvoiceColumns]);

  return (
    <div className="space-y-3" data-component-card>
        <FinanceSection ariaLabel="ملخص الفواتير">
          <InvoiceSummaryCards
            summary={summary}
            currentFilters={{ dateFrom, dateTo, tenantId, propertyId }}
            onStatusDrill={onStatusChange}
          />
        </FinanceSection>

        <FinanceSection ariaLabel="فلاتر الفواتير">
          <FinanceFilterBar ariaLabel="فلاتر الفواتير" className="rounded-xl border border-border/70 bg-card p-2 shadow-card">
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

        <FinanceSection ariaLabel="قائمة الفواتير">
          <div data-finance-table-wrapper>
            <EntityTable
              aria-label="جدول الفواتير"
              rows={invoices}
              keyOf={(invoice) => invoice.id}
              visibleColumnKeys={visibleColumnKeys}
              toolbar={(
                <div className="flex justify-end">
                  <DataTableColumnsMenu
                    columns={invoiceColumnOptions}
                    visibleKeys={visibleColumnKeys}
                    onChange={setVisibleColumnKeys}
                  />
                </div>
              )}
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
              pagination={{ page, pageSize, total, onPageChange }}
              mobileBadgeKey="status"
              mobileSummaryKeys={['due_date', 'gross', 'paid_amount', 'remaining']}
              mobileCardActions={(invoice) => {
                const showCollect = Boolean(canCollectPayments && onCollectInvoice && isInvoiceCollectible(invoice));
                return [
                  ...(showCollect ? [{
                    label: 'تحصيل',
                    icon: HandCoins,
                    variant: 'secondary' as const,
                    ariaLabel: `تحصيل ${invoice.reference ?? 'فاتورة مسجلة'}`,
                    onClick: () => onCollectInvoice!(invoice.id),
                  }] : []),
                  ...(onPrintInvoice ? [{
                    label: 'طباعة',
                    icon: Printer,
                    variant: 'secondary' as const,
                    ariaLabel: `طباعة ${invoice.reference ?? 'الفاتورة'}`,
                    onClick: () => onPrintInvoice(invoice.id),
                  }] : []),
                  ...(onExportInvoice ? [{
                    label: 'PDF',
                    icon: Download,
                    variant: 'secondary' as const,
                    ariaLabel: `تنزيل ${invoice.reference ?? 'الفاتورة'} بصيغة PDF`,
                    onClick: () => onExportInvoice(invoice.id),
                  }] : []),
                ];
              }}
              columns={[
                {
                  key: 'id',
                  header: 'رقم الفاتورة',
                  priority: 'identity',
                  render: (invoice) => <span className="font-bold tabular-nums">{invoice.reference ?? 'فاتورة بلا مرجع'}</span>,
                },
                {
                  key: 'due_date',
                  header: 'تاريخ الاستحقاق',
                  priority: 'secondary',
                  render: (invoice) => (
                    <span dir="ltr" className="tabular-nums">
                      {formatDate(invoice.due_date)}
                    </span>
                  ),
                },
                {
                  key: 'gross',
                  header: 'الإجمالي شامل VAT',
                  priority: 'detail',
                  render: (invoice) => {
                    const grossAmount = getInvoiceGrossAmount(invoice);
                    return (
                      <span className="inline-flex flex-col">
                        <FinanceAmount>{formatMoney(grossAmount)}</FinanceAmount>
                        {invoice.tax_amount ? (
                          <span className="text-xs text-muted-foreground">
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
                  priority: 'detail',
                  render: (invoice) => <FinanceAmount className="text-success">{formatMoney(invoice.paid_amount)}</FinanceAmount>,
                },
                {
                  key: 'remaining',
                  header: 'المتبقي',
                  priority: 'primary',
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
                  priority: 'secondary',
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
                  priority: 'actions',
                  render: (invoice) => {
                    const showCollect = canCollectPayments && onCollectInvoice && isInvoiceCollectible(invoice);
                    if (!showCollect && !onPrintInvoice && !onExportInvoice) return null;
                    return (
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {showCollect ? (
                          <Button
                            size="sm"
                            className="h-11 min-w-11 px-2.5"
                            aria-label={`تحصيل ${invoice.reference ?? 'فاتورة مسجلة'}`}
                            onClick={() => onCollectInvoice(invoice.id)}
                            title="تسجيل دفعة على هذه الفاتورة مباشرة"
                          >
                            <HandCoins className="size-3.5" />
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
            />
          </div>
        </FinanceSection>
    </div>
  );
}