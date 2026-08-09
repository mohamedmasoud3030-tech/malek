import { HandCoins } from 'lucide-react';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OverdueInvoiceReportRow } from '../reports/financialReportsService';
import { ARABIC_LOCALE, EMPTY_FIELD_VALUE, getArrearsBucketLabel, getOverdueRowBucketKey } from './arrears-workflow-helpers';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';

type OverdueInvoicesTableProps = Readonly<{
  rows: OverdueInvoiceReportRow[];
  selectedInvoiceId: string;
  onSelectInvoice: (invoiceId: string) => void;
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
        <Button variant="link" className="min-h-11 px-1 font-black" onClick={() => onSelectInvoice(row.invoiceId)}>
          {row.invoiceReference ?? 'فاتورة بلا مرجع'}
        </Button>
      ),
    },
    { key: 'tenant', header: 'المستأجر', render: (row) => row.tenantName ?? EMPTY_FIELD_VALUE },
    { key: 'context', header: 'العقار / الوحدة', render: (row) => getContextLabel(row) },
    { key: 'contract_id', header: 'العقد', render: (row) => row.contractReference ?? 'عقد بلا مرجع' },
    { key: 'due_date', header: 'الاستحقاق', render: (row) => formatDate(row.dueDate) },
    { key: 'days_overdue', header: 'أيام التأخير', render: (row) => formatLatinNumber(row.daysOverdue, ARABIC_LOCALE) },
    { key: 'amount', header: 'الإجمالي', render: (row) => <span dir="ltr">{formatMoney(row.amount)}</span> },
    { key: 'paid', header: 'المدفوع', render: (row) => <span dir="ltr">{formatMoney(row.paidAmount)}</span> },
    { key: 'remaining', header: 'المتبقي', render: (row) => <span dir="ltr" className="font-black text-destructive">{formatMoney(row.remainingAmount)}</span> },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => <StatusBadge tone="neutral">{formatInvoiceStatusLabel(row.status)}</StatusBadge>,
    },
    { key: 'bucket', header: 'العمر', render: (row) => getArrearsBucketLabel(getOverdueRowBucketKey(row)) },
    ...(onCollectInvoice ? [{
      key: 'actions',
      header: 'إجراء',
      render: (row: OverdueInvoiceReportRow) => (
        <Button className="min-h-11" onClick={() => onCollectInvoice(row.invoiceId)} title="انتقال مباشر لتسجيل دفعة على هذه الفاتورة">
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
      emptyDescription="لا توجد فواتير متأخرة حتى تاريخ التقرير الحالي."
    />
  );
}

type SelectedOverdueInvoiceCardProps = Readonly<{
  row: OverdueInvoiceReportRow | undefined;
  onShowInvoice: (invoiceId: string) => void;
  onCollectInvoice?: (invoiceId: string) => void;
}>;

export function SelectedOverdueInvoiceCard({ row, onShowInvoice, onCollectInvoice }: SelectedOverdueInvoiceCardProps) {
  if (!row) {
    return (
      <div className="rounded-3xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
        اختر فاتورة متأخرة من القائمة لعرض تفاصيل التحصيل.
      </div>
    );
  }

  const bucket = getOverdueRowBucketKey(row);
  return (
    <div className="rounded-3xl border bg-background p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted-foreground">تفاصيل التحصيل</p>
          <h3 className="mt-1 text-lg font-black">فاتورة {row.invoiceReference ?? 'فاتورة بلا مرجع'}</h3>
        </div>
        <StatusBadge tone="danger">{getArrearsBucketLabel(bucket)}</StatusBadge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">المستأجر</dt><dd className="font-bold">{row.tenantName ?? EMPTY_FIELD_VALUE}</dd></div>
        <div><dt className="text-xs text-muted-foreground">السياق</dt><dd className="font-bold">{getContextLabel(row)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">تاريخ الاستحقاق</dt><dd className="font-bold">{formatDate(row.dueDate)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">المتبقي</dt><dd dir="ltr" className="font-black text-destructive">{formatMoney(row.remainingAmount)}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onCollectInvoice ? (
          <Button className="min-h-11" onClick={() => onCollectInvoice(row.invoiceId)}>
            <HandCoins className="me-2 size-4" />بدء التحصيل الآن
          </Button>
        ) : null}
        <Button className="min-h-11" variant="secondary" onClick={() => onShowInvoice(row.invoiceId)}>عرض الفاتورة في قسم الفواتير</Button>
        {!onCollectInvoice ? <p className="text-xs text-muted-foreground">حسابك لا يملك صلاحية تسجيل دفعات من هذا القسم.</p> : null}
      </div>
    </div>
  );
}
