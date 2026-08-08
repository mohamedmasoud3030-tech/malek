/*
 * ============================================
 * MALIK PRO - Invoices & Receipts Table
 * جدول الفواتير وسندات المقبوضات
 * ============================================
 */

import { useState } from 'react';
import { 
  FileText, 
  Receipt, 
  Printer, 
  Download,
  Search,
  HandCoins,
  Eye,
} from 'lucide-react';
import {
  MalikCard,
  MalikCardHeader,
  MalikCardContent,
  MalikTabs,
  MalikFilterTabs,
  MalikTable,
  MalikTablePagination,
  MalikButton,
  MalikInput,
  MalikStatusBadge,
  MalikBadge,
  MalikAmountCard,
  MalikEmptyState,
  MalikLoadingState,
} from '@/components/malik-pro';
import type { Invoice, Receipt as ReceiptType } from '@/types/domain';

// ── Types ──
export interface InvoiceRow {
  id: string;
  invoice_number: string;
  tenant_name: string;
  property_title: string;
  unit_number: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  status: 'paid' | 'unpaid' | 'partial' | 'overdue';
  created_at: string;
}

export interface ReceiptRow {
  id: string;
  receipt_number: string;
  tenant_name: string;
  property_title: string;
  unit_number: string;
  amount: number;
  payment_method: 'bank_transfer' | 'cash' | 'card';
  payment_date: string;
  reference_number?: string;
  created_at: string;
}

export interface InvoicesReceiptsSectionProps {
  // Invoices
  invoices: InvoiceRow[];
  invoicesLoading?: boolean;
  invoicesTotal: number;
  invoicesPage: number;
  invoicesPageSize: number;
  onInvoicesPageChange: (page: number) => void;
  onInvoiceSelect: (invoice: InvoiceRow) => void;
  onInvoiceCollect?: (invoice: InvoiceRow) => void;
  onInvoicePrint?: (invoice: InvoiceRow) => void;
  onInvoiceExport?: (invoice: InvoiceRow) => void;

  // Receipts
  receipts: ReceiptRow[];
  receiptsLoading?: boolean;
  receiptsTotal: number;
  receiptsPage: number;
  receiptsPageSize: number;
  onReceiptsPageChange: (page: number) => void;
  onReceiptSelect: (receipt: ReceiptRow) => void;
  onReceiptPrint?: (receipt: ReceiptRow) => void;

  // Currency
  currencySymbol?: string;
}

// ── Invoice Table Columns ──
const invoiceColumns = [
  {
    key: 'invoice_number',
    header: 'رقم الفاتورة',
    render: (row: InvoiceRow) => (
      <span className="font-bold tabular-nums">#{row.invoice_number}</span>
    ),
  },
  {
    key: 'tenant',
    header: 'المستأجر والوحدة',
    render: (row: InvoiceRow) => (
      <div className="space-y-1">
        <span className="font-medium">{row.tenant_name}</span>
        <br />
        <span className="text-xs text-[hsl(var(--malik-foreground-muted))]">
          {row.property_title} - {row.unit_number}
        </span>
      </div>
    ),
  },
  {
    key: 'amount',
    header: 'المبلغ المستحق (ر.ع)',
    align: 'right' as const,
    render: (row: InvoiceRow) => (
      <span className="font-bold tabular-nums">
        ر.ع {row.amount.toLocaleString('ar-OM', { minimumFractionDigits: 3 })}
      </span>
    ),
  },
  {
    key: 'due_date',
    header: 'تاريخ الاستحقاق',
    align: 'center' as const,
    render: (row: InvoiceRow) => (
      <span className="text-sm tabular-nums" dir="ltr">
        {new Date(row.due_date).toLocaleDateString('ar-OM')}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'الحالة',
    align: 'center' as const,
    render: (row: InvoiceRow) => (
      <MalikStatusBadge status={row.status} />
    ),
  },
  {
    key: 'actions',
    header: 'إجراءات',
    align: 'center' as const,
    render: (row: InvoiceRow, { onCollect, onPrint, onExport }: InvoiceActions) => (
      <div className="flex items-center gap-2 justify-center">
        {onCollect && row.status !== 'paid' && (
          <MalikButton
            size="sm"
            variant="soft"
            onClick={() => onCollect(row)}
            leftIcon={<HandCoins className="size-3.5" />}
          >
            تحصيل
          </MalikButton>
        )}
        {(onPrint || onExport) && (
          <div className="flex gap-1">
            {onPrint && (
              <MalikButton
                size="sm"
                variant="outline"
                onClick={() => onPrint(row)}
                className="size-8 p-0"
                aria-label="طباعة"
              >
                <Printer className="size-4" />
              </MalikButton>
            )}
            {onExport && (
              <MalikButton
                size="sm"
                variant="outline"
                onClick={() => onExport(row)}
                className="size-8 p-0"
                aria-label="تصدير PDF"
              >
                <Download className="size-4" />
              </MalikButton>
            )}
          </div>
        )}
      </div>
    ),
  },
];

interface InvoiceActions {
  onCollect?: (invoice: InvoiceRow) => void;
  onPrint?: (invoice: InvoiceRow) => void;
  onExport?: (invoice: InvoiceRow) => void;
}

// ── Receipt Table Columns ──
const receiptColumns = [
  {
    key: 'receipt_number',
    header: 'رقم السند',
    render: (row: ReceiptRow) => (
      <span className="font-bold tabular-nums">#{row.receipt_number}</span>
    ),
  },
  {
    key: 'date',
    header: 'التاريخ',
    render: (row: ReceiptRow) => (
      <span className="tabular-nums" dir="ltr">
        {new Date(row.payment_date).toLocaleDateString('ar-OM')}
      </span>
    ),
  },
  {
    key: 'tenant',
    header: 'المستأجر',
    render: (row: ReceiptRow) => (
      <div className="space-y-1">
        <span className="font-medium">{row.tenant_name}</span>
        <br />
        <span className="text-xs text-[hsl(var(--malik-foreground-muted))]">
          {row.property_title} - {row.unit_number}
        </span>
      </div>
    ),
  },
  {
    key: 'amount',
    header: 'المبلغ المقبوض (ر.ع)',
    align: 'right' as const,
    render: (row: ReceiptRow) => (
      <span className="font-bold text-[hsl(var(--malik-success))] tabular-nums">
        ر.ع {row.amount.toLocaleString('ar-OM', { minimumFractionDigits: 3 })}
      </span>
    ),
  },
  {
    key: 'method',
    header: 'طريقة الدفع',
    align: 'center' as const,
    render: (row: ReceiptRow) => {
      const methodLabels = {
        bank_transfer: 'تحويل بنكي',
        cash: 'نقداً',
        card: 'بطاقة',
      };
      return (
        <MalikBadge variant="info">
          {methodLabels[row.payment_method]}
        </MalikBadge>
      );
    },
  },
  {
    key: 'reference',
    header: 'المرجع',
    align: 'center' as const,
    render: (row: ReceiptRow) => (
      <span className="text-xs text-[hsl(var(--malik-foreground-muted))]">
        {row.reference_number || '—'}
      </span>
    ),
  },
  {
    key: 'actions',
    header: 'إجراءات',
    align: 'center' as const,
    render: (row: ReceiptRow, { onPrint }: ReceiptActions) => (
      <div className="flex items-center gap-2 justify-center">
        <MalikButton
          size="sm"
          variant="outline"
          onClick={() => onPrint?.(row)}
          className="size-8 p-0"
          aria-label="طباعة"
        >
          <Printer className="size-4" />
        </MalikButton>
      </div>
    ),
  },
];

interface ReceiptActions {
  onPrint?: (receipt: ReceiptRow) => void;
}

// ── Empty State Component ──
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div data-malik-empty className="py-12">
      <div data-malik-empty-icon>{icon}</div>
      <h3 data-malik-empty-title>{title}</h3>
      <p data-malik-empty-desc>{description}</p>
    </div>
  );
}

// ── Main Component ──
export function InvoicesReceiptsSection({
  invoices,
  invoicesLoading = false,
  invoicesTotal,
  invoicesPage,
  invoicesPageSize,
  onInvoicesPageChange,
  onInvoiceSelect,
  onInvoiceCollect,
  onInvoicePrint,
  onInvoiceExport,
  receipts,
  receiptsLoading = false,
  receiptsTotal,
  receiptsPage,
  receiptsPageSize,
  onReceiptsPageChange,
  onReceiptSelect,
  onReceiptPrint,
}: InvoicesReceiptsSectionProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'receipts'>('invoices');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'unpaid' | 'overdue'>('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [receiptSearch, setReceiptSearch] = useState('');

  const filteredInvoices = invoices.filter((inv) => {
    // Search filter
    if (invoiceSearch) {
      const search = invoiceSearch.toLowerCase();
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(search) ||
        inv.tenant_name.toLowerCase().includes(search) ||
        inv.property_title.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (invoiceFilter === 'unpaid') return inv.status === 'unpaid';
    if (invoiceFilter === 'overdue') return inv.status === 'overdue';
    return true;
  });

  const filteredReceipts = receipts.filter((rec) => {
    if (receiptSearch) {
      const search = receiptSearch.toLowerCase();
      return (
        rec.receipt_number.toLowerCase().includes(search) ||
        rec.tenant_name.toLowerCase().includes(search) ||
        rec.property_title.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const invoiceTabCounts = {
    all: invoices.length,
    unpaid: invoices.filter((i) => i.status === 'unpaid').length,
    overdue: invoices.filter((i) => i.status === 'overdue').length,
  };

  const invoiceFilters = [
    { id: 'all', label: 'الكل', count: invoiceTabCounts.all },
    { id: 'unpaid', label: 'غير مدفوعة', count: invoiceTabCounts.unpaid },
    { id: 'overdue', label: 'متأخرة', count: invoiceTabCounts.overdue },
  ];

  const invoiceActions: InvoiceActions = {
    onCollect: onInvoiceCollect,
    onPrint: onInvoicePrint,
    onExport: onInvoiceExport,
  };

  const receiptActions: ReceiptActions = {
    onPrint: onReceiptPrint,
  };

  return (
    <MalikCard variant="default">
      <MalikCardHeader>
        <div className="flex flex-col gap-4 w-full sm:flex-row sm:items-center sm:justify-between">
          {/* Tab Navigation */}
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--malik-primary-soft))]">
              <FileText className="size-5 text-[hsl(var(--malik-primary))]" />
            </div>
            <div>
              <p className="text-sm font-bold">الفواتير والمستقبوضات</p>
              <p className="text-xs text-[hsl(var(--malik-foreground-muted))]">
                إدارة الفواتير وتسجيل الدفعات
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <MalikTabs
            tabs={[
              { id: 'invoices', label: 'جدول الفواتير', icon: <FileText className="size-4" /> },
              { id: 'receipts', label: 'سندات المقبوضات', icon: <Receipt className="size-4" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as 'invoices' | 'receipts')}
            variant="pills"
          />
        </div>
      </MalikCardHeader>

      <MalikCardContent className="space-y-4">
        {activeTab === 'invoices' ? (
          <>
            {/* Invoice Filters & Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <MalikFilterTabs
                tabs={invoiceFilters}
                activeTab={invoiceFilter}
                onTabChange={(id) => setInvoiceFilter(id as 'all' | 'unpaid' | 'overdue')}
              />
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--malik-foreground-muted))]" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="w-full sm:w-64 pr-10 pl-4 py-2 rounded-lg border border-[hsl(var(--malik-border))] bg-[hsl(var(--malik-card))] text-sm"
                />
              </div>
            </div>

            {/* Invoice Table */}
            {invoicesLoading ? (
              <MalikLoadingState />
            ) : filteredInvoices.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-8" />}
                title="لا توجد فواتير"
                description={
                  invoiceSearch || invoiceFilter !== 'all'
                    ? 'لا توجد فواتير مطابقة للبحث'
                    : 'ستظهر الفواتير هنا عند إنشاءها'
                }
              />
            ) : (
              <>
                <MalikTable
                  columns={invoiceColumns.map((col) => ({
                    ...col,
                    render: col.key === 'actions'
                      ? (row: InvoiceRow) => col.render?.(row, invoiceActions)
                      : col.render,
                  }))}
                  data={filteredInvoices}
                  keyOf={(row) => row.id}
                  onRowClick={onInvoiceSelect}
                  emptyTitle="لا توجد فواتير"
                />
                <MalikTablePagination
                  currentPage={invoicesPage}
                  totalPages={Math.ceil(invoicesTotal / invoicesPageSize)}
                  onPageChange={onInvoicesPageChange}
                  totalItems={invoicesTotal}
                  itemsPerPage={invoicesPageSize}
                />
              </>
            )}
          </>
        ) : (
          <>
            {/* Receipts Search */}
            <div className="flex justify-end">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--malik-foreground-muted))]" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  className="w-full sm:w-64 pr-10 pl-4 py-2 rounded-lg border border-[hsl(var(--malik-border))] bg-[hsl(var(--malik-card))] text-sm"
                />
              </div>
            </div>

            {/* Receipts Table */}
            {receiptsLoading ? (
              <MalikLoadingState />
            ) : filteredReceipts.length === 0 ? (
              <EmptyState
                icon={<Receipt className="size-8" />}
                title="لا توجد سندات قبض"
                description={
                  receiptSearch
                    ? 'لا توجد سندات مطابقة للبحث'
                    : 'ستظهر سندات القبض هنا عند تسجيل الدفعات'
                }
              />
            ) : (
              <>
                <MalikTable
                  columns={receiptColumns.map((col) => ({
                    ...col,
                    render: col.key === 'actions'
                      ? (row: ReceiptRow) => col.render?.(row, receiptActions)
                      : col.render,
                  }))}
                  data={filteredReceipts}
                  keyOf={(row) => row.id}
                  onRowClick={onReceiptSelect}
                  emptyTitle="لا توجد سندات قبض"
                />
                <MalikTablePagination
                  currentPage={receiptsPage}
                  totalPages={Math.ceil(receiptsTotal / receiptsPageSize)}
                  onPageChange={onReceiptsPageChange}
                  totalItems={receiptsTotal}
                  itemsPerPage={receiptsPageSize}
                />
              </>
            )}
          </>
        )}
      </MalikCardContent>
    </MalikCard>
  );
}
