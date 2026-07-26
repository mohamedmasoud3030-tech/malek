import { AlertTriangle } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { formatDate, formatInvoiceStatusLabel, formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { SafeAnchor } from '../common';
import { ReportPanel, ReportState } from '../report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

export function OverdueInvoicesPanel({
  rows,
  action,
  isLoading,
}: Readonly<{
  rows: OverdueInvoiceReportRow[];
  action?: React.ReactNode;
  isLoading: boolean;
}>) {
  return (
    <ReportPanel
      title="الفواتير المتأخرة"
      description="الفاتورة والعقد والمستأجر وتاريخ الاستحقاق والرصيد المتبقي."
      icon={AlertTriangle}
      action={action}
      isLoading={isLoading}
    >
      {rows.length === 0 ? (
        <div className="p-4"><ReportState message="لا توجد فواتير متأخرة حسب تاريخ التقرير." /></div>
      ) : (
        <>
          <div className="grid gap-3 p-4 md:hidden">
            {rows.slice(0, 20).map((row) => (
              <MobileCard
                key={row.invoiceId}
                title={row.tenantName ?? 'مستأجر غير محدد'}
                subtitle={`${formatDate(row.dueDate)} · ${formatInvoiceStatusLabel(row.status)}`}
                badge={<span className="text-xs font-bold text-destructive">{formatLatinNumber(row.daysOverdue, 'ar')} يوم</span>}
                meta={<SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={`عقد ${formatShortId(row.contractId)}`} />}
                stats={(
                  <div className="flex items-center justify-between gap-2">
                    <SafeAnchor href="/invoices" label={row.shortInvoiceId} />
                    <span className="font-bold text-destructive" dir="ltr">{formatMoney(row.remainingAmount)}</span>
                  </div>
                )}
              />
            ))}
          </div>

          <div className="hidden px-4 pb-4 md:block">
            <DataTable
              aria-label="جدول الفواتير المتأخرة"
              rows={rows}
              columns={[
                { key: 'invoice', header: 'الفاتورة', render: (row) => <SafeAnchor href="/invoices" label={row.shortInvoiceId} /> },
                { key: 'contract', header: 'العقد', render: (row) => <SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} /> },
                { key: 'tenant', header: 'المستأجر', render: (row) => row.tenantName ?? '—' },
                { key: 'dueDate', header: 'الاستحقاق', render: (row) => formatDate(row.dueDate) },
                { key: 'days', header: 'التأخير', render: (row) => `${formatLatinNumber(row.daysOverdue, 'ar')} يوم` },
                { key: 'remaining', header: 'المتبقي', render: (row) => <span className="font-bold text-destructive" dir="ltr">{formatMoney(row.remainingAmount)}</span> },
                { key: 'status', header: 'الحالة', render: (row) => formatInvoiceStatusLabel(row.status) },
              ]}
              keyOf={(row) => row.invoiceId}
              emptyTitle="لا توجد فواتير متأخرة"
              emptyDescription="لا توجد فواتير متأخرة حسب تاريخ التقرير."
            />
          </div>
        </>
      )}
    </ReportPanel>
  );
}
