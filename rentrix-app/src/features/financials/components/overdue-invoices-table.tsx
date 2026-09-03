import { useMemo } from 'react';
import { HandCoins } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OverdueInvoiceReportRow } from '../reports/financialReportsService';
import { ARABIC_LOCALE, EMPTY_FIELD_VALUE, getArrearsBucketLabel, getOverdueRowBucketKey } from './arrears-workflow-helpers';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from './financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';

type OverdueInvoicesTableProps = Readonly<{
  rows: OverdueInvoiceReportRow[];
  onSelectInvoice: (invoiceId: string) => void;
  onCollectInvoice?: (invoiceId: string) => void;
}>;

function getContextLabel(row: OverdueInvoiceReportRow) {
  const parts: string[] = [];
  if (row.propertyTitle) parts.push(row.propertyTitle);
  if (row.unitNumber) parts.push(`وحدة ${row.unitNumber}`);
  return parts.length > 0 ? parts.join(' · ') : EMPTY_FIELD_VALUE;
}

export function OverdueInvoicesTable({ rows, onSelectInvoice, onCollectInvoice }: OverdueInvoicesTableProps) {
  const columns = useMemo((): ColumnDef<OverdueInvoiceReportRow>[] => [
    {
      key: 'invoice_id', priority: 'identity' as const,
      header: 'الفاتورة',
      render: (row) => (
        <Button variant="link" className="min-h-11 px-1 font-black" onClick={() => onSelectInvoice(row.invoiceId)}>
          {row.invoiceReference ?? 'فاتورة بلا مرجع'}
        </Button>
      ),
    },
    {
      key: 'tenant', priority: 'secondary' as const, header: 'المستأجر', render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold">{row.tenantName ?? EMPTY_FIELD_VALUE}</p>
          {row.tenantPhone ? <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">{row.tenantPhone}</p> : null}
        </div>
      ),
    },
    { key: 'context', priority: 'detail' as const, header: 'العقار / الوحدة', render: (row) => getContextLabel(row) },
    { key: 'contract_id', priority: 'detail' as const, header: 'العقد', render: (row) => row.contractReference ?? 'عقد بلا مرجع' },
    { key: 'due_date', priority: 'secondary' as const, header: 'الاستحقاق', render: (row) => formatDate(row.dueDate) },
    { key: 'days_overdue', priority: 'secondary' as const, header: 'أيام التأخير', render: (row) => formatLatinNumber(row.daysOverdue, ARABIC_LOCALE) },
    { key: 'amount', priority: 'detail' as const, header: 'الإجمالي', render: (row) => <span dir="ltr">{formatMoney(row.amount)}</span> },
    { key: 'paid', priority: 'detail' as const, header: 'المدفوع', render: (row) => <span dir="ltr">{formatMoney(row.paidAmount)}</span> },
    { key: 'remaining', priority: 'primary' as const, header: 'المتبقي', render: (row) => <span dir="ltr" className="font-black text-destructive">{formatMoney(row.remainingAmount)}</span> },
    {
      key: 'status', priority: 'secondary' as const,
      header: 'الحالة',
      render: (row) => <StatusBadge tone="neutral">{formatInvoiceStatusLabel(row.status)}</StatusBadge>,
    },
    { key: 'bucket', priority: 'detail' as const, header: 'العمر', render: (row) => getArrearsBucketLabel(getOverdueRowBucketKey(row)) },
    ...(onCollectInvoice
      ? ([
          {
            key: 'actions',
            priority: 'actions' as const,
            header: 'إجراء',
            render: (row: OverdueInvoiceReportRow) => (
              <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <ActionMenu
                  label={`إجراءات ${row.invoiceReference ?? 'الفاتورة'}`}
                  items={[{
                    id: 'collect',
                    label: 'تحصيل',
                    icon: HandCoins,
                    onClick: () => onCollectInvoice(row.invoiceId),
                  }]}
                />
              </div>
            ),
          },
        ] satisfies ColumnDef<OverdueInvoiceReportRow>[])
      : []),
  ], [onCollectInvoice, onSelectInvoice]);

  return (
    <EntityTable
      aria-label="جدول الفواتير المتأخرة"
      rows={rows}
      columns={columns}
      keyOf={(row) => row.invoiceId}
      emptyTitle="لا توجد فواتير متأخرة"
      emptyDescription="لا توجد فواتير متأخرة حتى تاريخ التقرير الحالي."
      mobileCardType="invoice"
      mobileBadgeKey="status"
      mobileSupportingKey="tenant"
      mobilePrimaryMetaKeys={['remaining', 'due_date', 'days_overdue']}
      mobileSecondaryMetaKeys={['context', 'bucket']}
      mobileCardPrimaryAction={(row) => onCollectInvoice ? ({
        label: 'تحصيل الآن',
        icon: HandCoins,
        variant: 'default',
        ariaLabel: `تحصيل ${row.invoiceReference ?? 'الفاتورة'}`,
        onClick: () => onCollectInvoice(row.invoiceId),
      }) : ({
        label: 'عرض الفاتورة',
        variant: 'default',
        ariaLabel: `عرض ${row.invoiceReference ?? 'الفاتورة'}`,
        onClick: () => onSelectInvoice(row.invoiceId),
      })}
      mobileCardActions={(row) => onCollectInvoice ? [{
        label: 'عرض الفاتورة',
        variant: 'secondary' as const,
        ariaLabel: `عرض ${row.invoiceReference ?? 'الفاتورة'}`,
        onClick: () => onSelectInvoice(row.invoiceId),
      }] : []}
    />
  );
}
