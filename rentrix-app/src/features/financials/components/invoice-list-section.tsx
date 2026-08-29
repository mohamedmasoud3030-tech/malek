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
} from '../invoices/invoiceService';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
import { InvoiceFilters, type InvoiceFilterOption } from './invoice-filters';
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
  { key: 'tenant', label: 'المستأجر' },
  { key: 'property_unit', label: 'العقار / الوحدة' },
  { key: 'billing_period', label: 'فترة الاستحقاق' },
  { key: 'due_date', label: 'موعد السداد' },
  { key: 'gross', label: 'الإجمالي' },
  { key: 'paid_amount', label: 'المدفوع' },
  { key: 'remaining', label: 'المتبقي' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'الإجراءات', locked: true },
] as const;

const defaultInvoiceColumns = [
  'id',
  'tenant',
  'property_unit',
  'billing_period',
  'due_date',
  'gross',
  'remaining',
  'status',
  'actions',
];

const INVOICE_REGISTER_VIEW_MODE_KEY = 'malek:invoices:register-view-mode-v1';

type InvoiceListSectionProps = {
  status: InvoiceStatusFilter;
  invoiceSearch: string;
  invoices: InvoiceListItem[];
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

function billingPeriodLabel(invoice: InvoiceListItem) {
  const start = invoice.billing_period_start;
  const end = invoice.billing_period_end;
  if (!start && !end) return '—';
  if (start && end) return `${formatDate(start)} ← ${formatDate(end)}`;
  return formatDate(start || end || '');
}

export function InvoiceListSection({
  status,
  invoiceSearch,
  invoices,
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
  const [registerViewModeKey] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        if (!window.localStorage.getItem(INVOICE_REGISTER_VIEW_MODE_KEY)) {
          window.localStorage.setItem(INVOICE_REGISTER_VIEW_MODE_KEY, 'table');
        }
      } catch {
        // EntityTable still falls back safely when storage is unavailable.
      }
    }
    return INVOICE_REGISTER_VIEW_MODE_KEY;
  });

  return (
    <div className="space-y-3" data-invoice-register>
      <FinanceSection ariaLabel="البحث وحالة الفواتير">
        <FinanceFilterBar ariaLabel="البحث وحالة الفواتير" className="rounded-xl border border-border/70 bg-card p-2 shadow-card">
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

      <FinanceSection ariaLabel="سجل الفواتير">
        <div data-finance-table-wrapper>
          <EntityTable
            aria-label="سجل الفواتير"
            rows={invoices}
            keyOf={(invoice) => invoice.id}
            visibleColumnKeys={visibleColumnKeys}
            viewModeStorageKey={registerViewModeKey}
            toolbar={(
              <div className="flex min-w-0 items-center justify-between gap-3">
                <p className="truncate text-xs font-bold text-muted-foreground">
                  {total} فاتورة مطابقة · اضغط الصف للمعاينة أو «تحصيل» للدفع مباشرة
                </p>
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
                ? 'غيّر البحث أو الحالة أو الفلاتر للوصول إلى الفاتورة المطلوبة.'
                : 'لا توجد فواتير مسجلة في هذا المكتب حتى الآن.'
            }
            onRowClick={(invoice) => onSelectInvoice(invoice.id)}
            pagination={{ page, pageSize, total, onPageChange }}
            mobileBadgeKey="status"
            mobileVisibleSecondaryKey="tenant"
            mobileSummaryKeys={['tenant', 'property_unit', 'billing_period', 'remaining']}
            mobileCardPrimaryAction={(invoice) => ({
              label: isInvoiceCollectible(invoice) && canCollectPayments && onCollectInvoice ? 'تحصيل' : 'عرض الفاتورة',
              icon: isInvoiceCollectible(invoice) && canCollectPayments && onCollectInvoice ? HandCoins : undefined,
              variant: 'default',
              ariaLabel: isInvoiceCollectible(invoice) && canCollectPayments && onCollectInvoice
                ? `تحصيل ${invoice.reference ?? 'الفاتورة'}`
                : `عرض ${invoice.reference ?? 'الفاتورة'}`,
              onClick: () => {
                if (isInvoiceCollectible(invoice) && canCollectPayments && onCollectInvoice) onCollectInvoice(invoice.id);
                else onSelectInvoice(invoice.id);
              },
            })}
            mobileCardActions={(invoice) => [
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
            ]}
            columns={[
              {
                key: 'id',
                header: 'الفاتورة',
                priority: 'identity',
                render: (invoice) => (
                  <div className="min-w-0">
                    <p className="font-black tabular-nums">{invoice.reference ?? invoice.id.slice(0, 8)}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">إصدار {formatDate(invoice.issue_date)}</p>
                  </div>
                ),
              },
              {
                key: 'tenant',
                header: 'المستأجر',
                priority: 'primary',
                render: (invoice) => (
                  <div className="min-w-0">
                    <p className="max-w-48 truncate font-bold">{invoice.contracts?.people?.full_name ?? 'مستأجر غير محدد'}</p>
                    {invoice.contracts?.people?.phone ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">{invoice.contracts.people.phone}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'property_unit',
                header: 'العقار / الوحدة',
                priority: 'primary',
                render: (invoice) => (
                  <div className="min-w-0">
                    <p className="max-w-44 truncate font-bold">{invoice.contracts?.properties?.title ?? 'عقار غير محدد'}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {invoice.contracts?.units?.unit_number ? `وحدة ${invoice.contracts.units.unit_number}` : 'وحدة غير محددة'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'billing_period',
                header: 'الفترة',
                priority: 'secondary',
                render: (invoice) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums">{billingPeriodLabel(invoice)}</span>,
              },
              {
                key: 'due_date',
                header: 'الاستحقاق',
                priority: 'secondary',
                render: (invoice) => <span dir="ltr" className="whitespace-nowrap tabular-nums">{formatDate(invoice.due_date)}</span>,
              },
              {
                key: 'gross',
                header: 'الإجمالي',
                priority: 'detail',
                render: (invoice) => {
                  const grossAmount = getInvoiceGrossAmount(invoice);
                  return (
                    <span className="inline-flex flex-col">
                      <FinanceAmount>{formatMoney(grossAmount)}</FinanceAmount>
                      {invoice.tax_amount ? <span className="text-[11px] text-muted-foreground">VAT {formatMoney(invoice.tax_amount)}</span> : null}
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
                  const remaining = getSafeRemainingAmount(grossAmount, invoice.paid_amount);
                  return <FinanceAmount className={remaining > 0 ? 'text-destructive' : 'text-success'}>{formatMoney(remaining)}</FinanceAmount>;
                },
              },
              {
                key: 'status',
                header: 'الحالة',
                priority: 'secondary',
                render: (invoice) => (
                  <FinanceStatusBadge
                    kind={mapInvoiceStatusToFinanceKind(invoice.status)}
                    label={formatInvoiceStatusLabel(invoice.status)}
                  />
                ),
              },
              {
                key: 'actions',
                header: 'إجراءات',
                priority: 'actions',
                render: (invoice) => {
                  const showCollect = canCollectPayments && onCollectInvoice && isInvoiceCollectible(invoice);
                  if (!showCollect && !onPrintInvoice && !onExportInvoice) return null;
                  return (
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      {showCollect ? (
                        <Button
                          size="sm"
                          className="h-11 min-w-11 px-2.5"
                          aria-label={`تحصيل ${invoice.reference ?? 'فاتورة مسجلة'}`}
                          onClick={() => onCollectInvoice(invoice.id)}
                          title="تسجيل الدفعة من نفس سجل الفواتير"
                        >
                          <HandCoins className="size-3.5" />
                          تحصيل
                        </Button>
                      ) : null}
                      {(onPrintInvoice || onExportInvoice) ? (
                        <ActionMenu
                          label="إجراءات إضافية للفاتورة"
                          items={[
                            ...(onPrintInvoice ? [{ id: 'print', label: 'طباعة', icon: Printer, onClick: () => onPrintInvoice(invoice.id) }] : []),
                            ...(onExportInvoice ? [{ id: 'pdf', label: 'PDF', icon: Download, onClick: () => onExportInvoice(invoice.id) }] : []),
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
