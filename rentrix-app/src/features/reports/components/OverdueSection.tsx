import { AlertTriangle, FileSpreadsheet, Printer, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { formatDate, formatInvoiceStatusLabel, formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { useAgedReceivablesReport } from '@/features/financials/reports/useFinancialReports';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { agingBucketKeys, buildReportCsvFilename, downloadCsv } from '../reports-page.helpers';
import { buildAgingBucketChartRows } from '../reports-page.helpers';
import { ReportCard, SafeAnchor } from './common';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function OverdueSection({ rows, agedReport, canExportReports, isLoading }: Readonly<{
  rows: OverdueInvoiceReportRow[];
  agedReport: NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']> | undefined;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const bucketRows = buildAgingBucketChartRows(agedReport?.buckets, agingBucketKeys);

  const handlePrintOverdueReport = () => {
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف المتأخرات والديون التفصيلي',
        reportType: 'Overdue_Debts_Report',
        periodFrom: new Date().toISOString().slice(0, 10),
        periodTo: new Date().toISOString().slice(0, 10),
        sections: [
          {
            title: 'جدول الفواتير والذمم المتأخرة السداد',
            rows: rows.map((r) => ({
              label: `${r.tenantName || 'مستأجر'} - (فاتورة #${r.shortInvoiceId})`,
              value: `المبلغ: ${r.remainingAmount} ر.ع | أيام التأخير: ${r.daysOverdue} يوم | الاستحقاق: ${r.dueDate}`,
            })),
            totals: ['إجمالي المتأخرات', `${rows.reduce((sum, r) => sum + r.remainingAmount, 0).toLocaleString('ar-OM')} ر.ع`],
          },
        ],
        totalSummary: `عدد الفواتير المتأخرة: ${rows.length} | الإجمالي المستحق: ${rows.reduce((sum, r) => sum + r.remainingAmount, 0).toLocaleString('ar-OM')} ر.ع`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <ReportCard
        title="الفواتير المتأخرة والديون المستحقة"
        description="تفاصيل الفواتير والذمم المتأخرة المحسوبة حسب تاريخ اليوم مع أيام التأخير والرصيد المتبقي."
        action={canExportReports ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintOverdueReport} className="min-h-9 gap-1.5 text-xs font-bold">
              <Printer className="size-3.5 text-primary" aria-hidden="true" />
              طباعة كشف المتأخرات A4
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('overdue-invoices'), rows)} className="min-h-9 text-xs">
              <FileSpreadsheet className="me-1.5 size-3.5" />
              تصدير CSV
            </Button>
          </div>
        ) : undefined}
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
        title="تعتيق وتقادم الذمم حسب الفئة العمرية"
        description="ملخص توزيع الديون والذمم في فئات التعتيق المحاسبي (حالي، 1-30 يوم، 31-60 يوم، 61-90 يوم، +90 يوم)."
        action={canExportReports ? <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('aged-receivables'), bucketRows.map((row) => ({ bucket: row.bucket, total: row.total, invoiceCount: row.invoiceCount })))} className="min-h-9 text-xs"><FileSpreadsheet className="me-1.5 size-3.5" />تصدير CSV</Button> : undefined}
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
