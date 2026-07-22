import { HandCoins } from 'lucide-react';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OverdueInvoiceReportRow } from '../reports/financialReportsService';
import { ARABIC_LOCALE, EMPTY_FIELD_VALUE, getArrearsBucketLabel, getOverdueRowBucketKey } from './arrears-workflow-helpers';
import { formatDate, formatInvoiceStatusLabel, formatMoney, formatShortId } from './financials-formatters';

type OverdueInvoicesTableProps = Readonly<{
  rows: OverdueInvoiceReportRow[];
  selectedInvoiceId: string;
  onSelectInvoice: (invoiceId: string) => void;
  /** Optional «تحصيل» deep-link action for collectible rows. */
  onCollectInvoice?: (invoiceId: string) => void;
}>;

function getContextLabel(row: OverdueInvoiceReportRow) {
  const parts: string[] = [];
  if (row.propertyTitle) parts.push(row.propertyTitle);
  if (row.unitNumber) parts.push(`وحدة ${row.unitNumber}`);
  return parts.length > 0 ? parts.join(' · ') : EMPTY_FIELD_VALUE;
}

export function OverdueInvoicesTable({ rows, selectedInvoiceId, onSelectInvoice, onCollectInvoice }: OverdueInvoicesTableProps) {
  const columns: ColumnDef<OverdueInvoiceReportRow>[] = [
    {
      key: 'invoice_id',
      header: 'الفاتورة',
      render: (row) => (
        <button type="button" className="font-black text-primary underline-offset-4 hover:underline" onClick={() => onSelectInvoice(row.invoiceId)}>
          #{row.shortInvoiceId || row.invoiceId.slice(0, 8)}
        </button>
      ),
    },
    { key: 'tenant', header: 'المستأجر', render: (row) => row.tenantName ?? EMPTY_FIELD_VALUE },
    { key: 'context', header: 'العقار / الوحدة', render: (row) => getContextLabel(row) },
    { key: 'contract_id', header: 'العقد', render: (row) => formatShortId(row.contractId) },
    { key: 'due_date', header: 'الاستحقاق', render: (row) => formatDate(row.dueDate) },
    { key: 'days_overdue', header: 'أيام التأخير', render: (row) => row.daysOverdue.toLocaleString(ARABIC_LOCALE) },
    { key: 'amount', header: 'الإجمالي', render: (row) => formatMoney(row.amount) },
    { key: 'paid', header: 'المدفوع', render: (row) => formatMoney(row.paidAmount) },
    { key: 'remaining', header: 'المتبقي', render: (row) => <span className="font-black text-destructive">{formatMoney(row.remainingAmount)}</span> },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          {formatInvoiceStatusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'bucket',
      header: 'العمر',
      render: (row) => getArrearsBucketLabel(getOverdueRowBucketKey(row)),
    },
    ...(onCollectInvoice ? [{
      key: 'actions',
      header: 'إجراء',
      render: (row: OverdueInvoiceReportRow) => (
        <Button className="h-8" onClick={() => onCollectInvoice(row.invoiceId)} title="انتقال مباشر لتسجيل دفعة على هذه الفاتورة">
          <HandCoins className="me-1 size-4" />تحصيل
        </Button>
      ),
    }] : []),
  ];

  return (
    <EntityTable
      aria-label="جدول الفواتير المتأخرة"
      rows={rows}
      columns={columns}
      keyOf={(row) => row.invoiceId}
      emptyTitle="لا توجد فواتير متأخرة"
      emptyDescription="لا توجد فواتير متأخرة حسب تاريخ as-of."
      renderMobileCard={(row) => {
        const isSelected = selectedInvoiceId === row.invoiceId;
        const bucket = getOverdueRowBucketKey(row);
        return (
          <div className={cn('rounded-2xl border bg-background p-4 space-y-3', isSelected ? 'ring-2 ring-primary/40 bg-primary/5' : '')}>
            <div className="flex items-start justify-between gap-2">
              <button type="button" className="font-black text-primary underline-offset-4 hover:underline text-base" onClick={() => onSelectInvoice(row.invoiceId)}>
                #{row.shortInvoiceId || row.invoiceId.slice(0, 8)}
              </button>
              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">{getArrearsBucketLabel(bucket)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-xs text-muted-foreground">المستأجر</p><p className="font-medium">{row.tenantName ?? EMPTY_FIELD_VALUE}</p></div>
              <div><p className="text-xs text-muted-foreground">الموقع</p><p className="font-medium">{getContextLabel(row)}</p></div>
              <div><p className="text-xs text-muted-foreground">الاستحقاق</p><p className="font-medium">{formatDate(row.dueDate)}</p></div>
              <div><p className="text-xs text-muted-foreground">أيام التأخير</p><p className="font-bold text-destructive">{row.daysOverdue.toLocaleString(ARABIC_LOCALE)}</p></div>
              <div><p className="text-xs text-muted-foreground">المتبقي</p><p className="font-black text-destructive">{formatMoney(row.remainingAmount)}</p></div>
              <div><p className="text-xs text-muted-foreground">الحالة</p><span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">{formatInvoiceStatusLabel(row.status)}</span></div>
            </div>
            {onCollectInvoice ? (
              <Button className="min-h-11 w-full rounded-xl text-xs" onClick={() => onCollectInvoice(row.invoiceId)}>
                <HandCoins className="me-1 size-4" />تحصيل هذه الفاتورة
              </Button>
            ) : null}
          </div>
        );
      }}
    />
  );
}

type SelectedOverdueInvoiceCardProps = Readonly<{
  row: OverdueInvoiceReportRow | undefined;
  onShowInvoice: (invoiceId: string) => void;
  /** Optional «تحصيل» deep-link action replacing the read-only notice. */
  onCollectInvoice?: (invoiceId: string) => void;
}>;

export function SelectedOverdueInvoiceCard({ row, onShowInvoice, onCollectInvoice }: SelectedOverdueInvoiceCardProps) {
  if (!row) {
    return (
      <div className="rounded-3xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
        اختر فاتورة متأخرة من القائمة لعرض تفاصيل التحصيل للقراءة فقط.
      </div>
    );
  }

  const bucket = getOverdueRowBucketKey(row);
  return (
    <div className="rounded-3xl border bg-background p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted-foreground">تفاصيل تحصيل للقراءة فقط</p>
          <h3 className="mt-1 text-lg font-black">فاتورة #{row.shortInvoiceId || row.invoiceId.slice(0, 8)}</h3>
        </div>
        <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">{getArrearsBucketLabel(bucket)}</span>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">المستأجر</dt><dd className="font-bold">{row.tenantName ?? EMPTY_FIELD_VALUE}</dd></div>
        <div><dt className="text-xs text-muted-foreground">السياق</dt><dd className="font-bold">{getContextLabel(row)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">تاريخ الاستحقاق</dt><dd className="font-bold">{formatDate(row.dueDate)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">المتبقي</dt><dd className="font-black text-destructive">{formatMoney(row.remainingAmount)}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onCollectInvoice ? (
          <Button onClick={() => onCollectInvoice(row.invoiceId)}>
            <HandCoins className="me-2 size-4" />بدء التحصيل الآن
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => onShowInvoice(row.invoiceId)}>عرض الفاتورة في قسم الفواتير</Button>
        {!onCollectInvoice ? (
          <p className="text-xs text-muted-foreground">لا توجد إجراءات دفع أو مراسلات في هذا القسم ضمن هذا الإصدار.</p>
        ) : null}
      </div>
    </div>
  );
}
