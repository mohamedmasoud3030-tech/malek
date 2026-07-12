import { AlertTriangle, FileSpreadsheet, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { formatDate, formatInvoiceStatusLabel, formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { useAgedReceivablesReport } from '@/features/financials/reports/useFinancialReports';
import { agingBucketKeys, buildReportCsvFilename, downloadCsv } from '../reports-page.helpers';
import { buildAgingBucketChartRows } from '../reports-page.helpers';
import { ReportCard, SafeAnchor } from './common';

export function OverdueSection({ rows, agedReport, canExportReports, isLoading }: Readonly<{
  rows: OverdueInvoiceReportRow[];
  agedReport: NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']> | undefined;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const bucketRows = buildAgingBucketChartRows(agedReport?.buckets, agingBucketKeys);

  return (
    <div className="space-y-4">
      <ReportCard
        title="الفواتير المتأخرة حسب as-of"
        description="الفواتير المتأخرة المحسوبة من خدمة arrears الحالية حسب تاريخ الاحتساب."
        action={canExportReports ? <Button variant="secondary" onClick={() => downloadCsv(buildReportCsvFilename('overdue-invoices'), rows)}><FileSpreadsheet className="me-2 size-4" />تصدير CSV</Button> : undefined}
        isLoading={isLoading}
      >
        {/* Mobile cards */}
        <div className="grid gap-3 p-4 md:hidden">
          {rows.slice(0, 20).map((row) => (
            <MobileCard
              key={row.invoiceId}
              title={row.tenantName ?? '—'}
              subtitle={formatDate(row.dueDate)}
              badge={<span className="shrink-0 text-xs font-bold text-destructive">{row.daysOverdue.toLocaleString('ar')} يوم</span>}
              stats={<div className="flex items-center justify-between gap-2"><SafeAnchor href="/invoices" label={row.shortInvoiceId} /><span className="font-black text-destructive" dir="ltr">{formatMoney(row.remainingAmount)}</span></div>}
            />
          ))}
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد فواتير متأخرة حسب تاريخ as-of.</p> : null}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block px-4 pb-4">
          <DataTable
            aria-label="جدول الفواتير المتأخرة"
            rows={rows}
            columns={[
              { key: 'invoice', header: 'الفاتورة', render: (row) => <SafeAnchor href="/invoices" label={row.shortInvoiceId} /> },
              { key: 'contract', header: 'العقد', render: (row) => <SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} /> },
              { key: 'tenant', header: 'المستأجر', render: (row) => row.tenantName ?? '—' },
              { key: 'due_date', header: 'الاستحقاق', render: (row) => formatDate(row.dueDate) },
              { key: 'days_overdue', header: 'أيام التأخير', render: (row) => row.daysOverdue.toLocaleString('ar') },
              { key: 'remaining', header: 'المتبقي', render: (row) => <span dir="ltr">{formatMoney(row.remainingAmount)}</span> },
              { key: 'status', header: 'الحالة', render: (row) => formatInvoiceStatusLabel(row.status) },
            ]}
            keyOf={(row) => row.invoiceId}
            emptyTitle="لا توجد فواتير متأخرة"
            emptyDescription="لا توجد فواتير متأخرة حسب تاريخ as-of."
          />
        </div>
      </ReportCard>

      <ReportCard
        title="تقادم الذمم حسب الفئة العمرية"
        description="ملخص أعمار الذمم والفواتير المتراكمة في كل فئة عمرية."
        action={canExportReports ? <Button variant="secondary" onClick={() => downloadCsv(buildReportCsvFilename('aged-receivables'), bucketRows.map((row) => ({ bucket: row.bucket, total: row.total, invoiceCount: row.invoiceCount })))}><FileSpreadsheet className="me-2 size-4" />تصدير CSV</Button> : undefined}
        isLoading={isLoading}
      >
        <ResponsiveCardGrid className="p-4" desktopColumns={5}>
          {bucketRows.map((row) => {
            const isCurrent = row.bucket === agingBucketKeys[0];
            return (
              <KpiCard
                key={row.bucket}
                label={row.bucket}
                value={formatMoney(row.total)}
                icon={isCurrent ? WalletCards : AlertTriangle}
                accent={isCurrent ? 'emerald' : 'amber'}
                sub={`${row.invoiceCount.toLocaleString('ar')} فواتير`}
              />
            );
          })}
        </ResponsiveCardGrid>
      </ReportCard>
    </div>
  );
}
