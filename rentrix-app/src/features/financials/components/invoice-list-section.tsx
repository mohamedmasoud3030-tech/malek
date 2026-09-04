import { Button } from '@/components/ui/button';
import { Download, Eye, FolderOpen, HandCoins, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { toDateOnlyISO } from '@/lib/formatters';
import { getSafeRemainingAmount } from '../financialMath';
import { isInvoiceCollectible } from '../invoices/quick-collect';
import {
  getInvoiceGrossAmount,
  type InvoiceListItem,
  type InvoiceStatusFilter,
} from '../invoices/invoiceService';
import { calculateDaysOverdue } from '../reports/financialReportsService';
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
  onPreviewInvoice?: (invoice: InvoiceListItem) => void;
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

export function billingPeriodLabel(invoice: InvoiceListItem) {
  const start = invoice.billing_period_start;
  const end = invoice.billing_period_end;
  if (!start && !end) return '—';
  if (start && end) return `${formatDate(start)} ← ${formatDate(end)}`;
  return formatDate(start || end || '');
}

function invoiceDueAttention(invoice: InvoiceListItem, today: string) {
  const grossAmount = getInvoiceGrossAmount(invoice);
  const remaining = getSafeRemainingAmount(grossAmount, invoice.paid_amount);
  if (remaining <= 0 || !invoice.due_date) return null;
  if (invoice.due_date === today) return { label: 'مستحق اليوم', tone: 'warning' as const };
  if (invoice.due_date < today) {
    const daysOverdue = calculateDaysOverdue(invoice.due_date, today);
    return {
      label: daysOverdue > 0 ? `متأخر ${daysOverdue} يوم` : 'متأخر',
      tone: 'danger' as const,
    };
  }
  return null;
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
  onPreviewInvoice,
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
  const today = toDateOnlyISO(new Date());

  const invoiceColumns = useMemo((): ColumnDef<InvoiceListItem>[] => [
    {
      key: 'id',
      header: 'الفاتورة',
      priority: 'identity',
      render: (invoice) => (
        <div className="min-w-0">
          <p className="font-black tabular-nums">{invoice.reference ?? 'فاتورة بلا مرجع'}</p>
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
          <p className="min-w-0 truncate font-bold">{invoice.contracts?.people?.full_name ?? 'مستأجر غير محدد'}</p>
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
          <p className="min-w-0 truncate font-bold">{invoice.contracts?.properties?.title ?? 'عقار غير محدد'}</p>
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
      render: (invoice) => {
        const attention = invoiceDueAttention(invoice, today);
        return (
          <div className="min-w-0">
            <span dir="ltr" className="whitespace-nowrap font-semibold tabular-nums">{formatDate(invoice.due_date)}</span>
            {attention ? (
              <p className={attention.tone === 'danger'
                ? 'mt-0.5 whitespace-nowrap text-[11px] font-black text-destructive'
                : 'mt-0.5 whitespace-nowrap text-[11px] font-black text-warning'}>
                {attention.label}
              </p>
            ) : null}
          </div>
        );
      },
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
        return <FinanceAmount className={remaining > 0 ? 'text-base font-black text-destructive' : 'text-base font-black text-success'}>{formatMoney(remaining)}</FinanceAmount>;
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
        if (!showCollect && !onPrintInvoice && !onExportInvoice && !onSelectInvoice) return null;
        const menuItems = [
          ...(onPreviewInvoice ? [{
            id: 'preview',
            label: 'معاينة سريعة',
            icon: Eye,
            onClick: () => onPreviewInvoice(invoice),
          }] : []),
          { id: 'open-workspace', label: 'فتح مساحة الفاتورة', icon: FolderOpen, onClick: () => onSelectInvoice(invoice.id) },
          ...(showCollect ? [{
            id: 'collect',
            label: 'تحصيل',
            icon: HandCoins,
            onClick: () => onCollectInvoice(invoice.id),
          }] : []),
          ...(onPrintInvoice ? [{ id: 'print', label: 'طباعة', icon: Printer, onClick: () => onPrintInvoice(invoice.id) }] : []),
          ...(onExportInvoice ? [{ id: 'pdf', label: 'PDF', icon: Download, onClick: () => onExportInvoice(invoice.id) }] : []),
        ];
        return (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <ActionMenu
              variant="labeled"
              label={`إجراءات ${invoice.reference ?? 'الفاتورة'}`}
              items={menuItems}
            />
          </div>
        );
      },
    },
  ], [canCollectPayments, onCollectInvoice, onPrintInvoice, onExportInvoice, today]);

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
            columnVisibilityControl={(
              <DataTableColumnsMenu
                columns={invoiceColumnOptions}
                visibleKeys={visibleColumnKeys}
                onChange={setVisibleColumnKeys}
              />
            )}
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
          <p className="text-xs font-bold text-muted-foreground" aria-live="polite">
            {total} فاتورة مطابقة · اضغط الصف للمعاينة أو «تحصيل» للدفع مباشرة
          </p>
          <EntityTable
            aria-label="سجل الفواتير"
            viewModeStorageKey="malek:invoices:register-view-mode-v1"
            rows={invoices}
            keyOf={(invoice) => invoice.id}
            visibleColumnKeys={visibleColumnKeys}
            isLoading={isLoading}
            error={isError ? error : undefined}
            errorTitle="تعذر تحميل الفواتير"
            emptyTitle={hasInvoiceFilter ? 'لا توجد فواتير مطابقة' : 'لا توجد فواتير حتى الآن'}
            emptyDescription={
              hasInvoiceFilter
                ? 'غيّر البحث أو الحالة أو الفلاتر للوصول إلى الفاتورة المطلوبة.'
                : 'لا توجد فواتير مسجلة في هذا المكتب حتى الآن.'
            }
            onRowClick={(invoice) => {
              if (onPreviewInvoice) onPreviewInvoice(invoice);
              else onSelectInvoice(invoice.id);
            }}
            pagination={{ page, pageSize, total, onPageChange }}
            mobileCardType="invoice"
            mobileBadgeKey="status"
            mobileSupportingKey="tenant"
            mobilePrimaryMetaKeys={['remaining', 'due_date']}
            mobileSecondaryMetaKeys={['property_unit', 'billing_period', 'gross']}
            mobileCardPrimaryAction={(invoice) => ({
              label: 'معاينة سريعة',
              icon: Eye,
              variant: 'default' as const,
              ariaLabel: `معاينة ${invoice.reference ?? 'الفاتورة'}`,
              onClick: () => {
                if (onPreviewInvoice) onPreviewInvoice(invoice);
                else onSelectInvoice(invoice.id);
              },
            })}
            mobileCardActions={(invoice) => [
              {
                label: 'فتح مساحة الفاتورة',
                icon: FolderOpen,
                variant: 'secondary' as const,
                ariaLabel: `فتح مساحة ${invoice.reference ?? 'الفاتورة'}`,
                onClick: () => onSelectInvoice(invoice.id),
              },
              ...(isInvoiceCollectible(invoice) && canCollectPayments && onCollectInvoice ? [{
                label: 'تحصيل',
                icon: HandCoins,
                variant: 'secondary' as const,
                ariaLabel: `تحصيل ${invoice.reference ?? 'الفاتورة'}`,
                onClick: () => onCollectInvoice(invoice.id),
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
            ]}
            columns={invoiceColumns}
          />
        </div>
      </FinanceSection>
    </div>
  );
}
