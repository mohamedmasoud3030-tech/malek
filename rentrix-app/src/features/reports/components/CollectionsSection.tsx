import { FileSpreadsheet, Printer, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatDate, formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { buildReportCsvFilename, downloadCsv, latestReceiptLimit, toDailyCollectionCsv } from '../reports-page.helpers';
import type { RentRollReportRow } from '../reports-page.helpers';
import { createReceiptPrintHref } from '../reports-page.helpers';
import { ReportCard, SafeAnchor } from './common';

type RentRollRow = RentRollReportRow;

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function CollectionsSection({ rows, receiptRows, rentRollRows, canExportReports, isLoading }: Readonly<{
  rows: DailyCollectionReportRow[];
  receiptRows: Array<{ id: string; receipt_number: string; payment_date: string; amount: number; tenant_name: string | null }>;
  rentRollRows: RentRollRow[];
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const handlePrintCollectionsReport = () => {
    const totalCollected = rows.reduce((acc, r) => acc + r.totalPaid, 0);
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف حركة التحصيلات اليومية والتدفقات النقدية',
        reportType: 'Daily_Collections_Report',
        periodFrom: new Date().toISOString().slice(0, 10),
        periodTo: new Date().toISOString().slice(0, 10),
        sections: [
          {
            title: 'جدول المقبوضات حسب التاريخ وطرق السداد',
            rows: rows.map((r) => ({
              label: `تاريخ ${r.paymentDate} - (${r.paymentsCount} عمليات سداد)`,
              value: `إجمالي اليوم: ${r.totalPaid.toLocaleString('ar-OM')} ر.ع | نقداً: ${r.methodTotals.cash} | تحويل: ${r.methodTotals.bank_transfer} | شيك: ${r.methodTotals.check}`,
            })),
            totals: ['إجمالي المقبوضات للفترة', `${totalCollected.toLocaleString('ar-OM')} ر.ع`],
          },
        ],
        totalSummary: `إجمالي المبلغ المحصل: ${totalCollected.toLocaleString('ar-OM')} ر.ع`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <ReportCard
        title="التحصيل اليومي والتدفقات النقدية للفترة"
        description="تفصيل المقبوضات اليومية موصلة بطرق السداد المختلفة (نقداً، تحويل بنكي، شيك، بطاقات)."
        action={canExportReports ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintCollectionsReport} className="min-h-9 gap-1.5 text-xs font-bold">
              <Printer className="size-3.5 text-primary" aria-hidden="true" />
              طباعة حركة التحصيلات A4
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('daily-collection'), toDailyCollectionCsv(rows))} className="min-h-9 text-xs">
              <FileSpreadsheet className="me-1.5 size-3.5" />
              تصدير CSV
            </Button>
          </div>
        ) : undefined}
        isLoading={isLoading}
      >
        {/* Mobile cards */}
        <div className="grid gap-3 p-4 md:hidden">
          {rows.map((row) => (
            <MobileCard
              key={row.paymentDate}
              title={formatDate(row.paymentDate)}
              stats={<span className="text-base font-black" dir="ltr">{formatMoney(row.totalPaid)}</span>}
              meta={(
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>نقداً: <span className="font-medium text-foreground" dir="ltr">{formatMoney(row.methodTotals.cash)}</span></span>
                  <span>تحويل: <span className="font-medium text-foreground" dir="ltr">{formatMoney(row.methodTotals.bank_transfer)}</span></span>
                  <span>بطاقة: <span className="font-medium text-foreground" dir="ltr">{formatMoney(row.methodTotals.card)}</span></span>
                  <span>شيك: <span className="font-medium text-foreground" dir="ltr">{formatMoney(row.methodTotals.check)}</span></span>
                </div>
              )}
            />
          ))}
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد تحصيلات في الفترة المحددة.</p> : null}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block px-4 pb-4">
          <DataTable
            aria-label="جدول التحصيل اليومي"
            rows={rows}
            columns={[
              { key: 'date', header: 'التاريخ', render: (row) => formatDate(row.paymentDate) },
              { key: 'total', header: 'الإجمالي', render: (row) => <span dir="ltr">{formatMoney(row.totalPaid)}</span> },
              { key: 'count', header: 'عدد المدفوعات', render: (row) => row.paymentsCount.toLocaleString('ar') },
              { key: 'cash', header: 'نقداً', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.cash)}</span> },
              { key: 'transfer', header: 'تحويل', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.bank_transfer)}</span> },
              { key: 'card', header: 'بطاقة', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.card)}</span> },
              { key: 'check', header: 'شيك', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.check)}</span> },
            ]}
            keyOf={(row) => row.paymentDate}
            emptyTitle="لا توجد تحصيلات"
            emptyDescription="لا توجد تحصيلات في الفترة المحددة."
          />
        </div>
        <div className="border-t border-border/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-black">روابط الإيصالات المتاحة</p>
              <p className="text-xs text-muted-foreground">أحدث {latestReceiptLimit} إيصال قابل للفتح والطباعة المعتمدة من السجل.</p>
            </div>
            <ReceiptText className="size-5 text-primary" />
          </div>
          <ResponsiveCardGrid desktopColumns={3} gap="sm">
            {receiptRows.map((receipt) => (
              <a key={receipt.id} className="rounded-2xl border border-border bg-background/80 p-3 transition hover:border-primary/40" href={createReceiptPrintHref(receipt.id)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black">{receipt.receipt_number}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(receipt.payment_date)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{receipt.tenant_name ?? '—'}</span>
                  <span className="font-black" dir="ltr">{formatMoney(receipt.amount)}</span>
                </div>
              </a>
            ))}
            {receiptRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد إيصالات متاحة ضمن الفترة المحددة.</p> : null}
          </ResponsiveCardGrid>
        </div>
      </ReportCard>

      <ReportCard
        title="سجل عقود الإيجار الجارية (Rent Roll)"
        description="بيانات العقد، اسم المستأجر، العين المؤجرة، وقيمة الدفعة الإيجارية."
        action={canExportReports ? <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('rent-roll'), rentRollRows)} className="min-h-9 text-xs"><FileSpreadsheet className="me-1.5 size-3.5" />تصدير CSV</Button> : undefined}
        isLoading={isLoading}
      >
        {/* Mobile cards */}
        <div className="grid gap-3 p-4 md:hidden">
          {rentRollRows.map((row) => (
            <MobileCard
              key={row.contractId}
              title={row.tenantName}
              subtitle={`${row.propertyTitle} · ${row.unitNumber}`}
              badge={<StatusBadge tone="green">{row.statusLabel}</StatusBadge>}
              meta={<span className="text-xs text-muted-foreground">{row.paymentCycle} · {formatDate(row.startDate)} — {formatDate(row.endDate)}</span>}
              stats={<div className="flex items-center justify-between gap-2"><SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} /><span className="font-black" dir="ltr">{formatMoney(row.rentAmount)}</span></div>}
            />
          ))}
          {rentRollRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عقود ضمن البيانات الحالية.</p> : null}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block px-4 pb-4">
          <DataTable
            aria-label="جدول عقود الإيجار"
            rows={rentRollRows}
            columns={[
              { key: 'contract', header: 'العقد', render: (row) => <SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} /> },
              { key: 'tenant', header: 'المستأجر', render: (row) => row.tenantName },
              { key: 'property', header: 'العقار/الوحدة', render: (row) => `${row.propertyTitle} · ${row.unitNumber}` },
              { key: 'rent', header: 'الإيجار', render: (row) => <span dir="ltr">{formatMoney(row.rentAmount)}</span> },
              { key: 'cycle', header: 'الدورة', render: (row) => row.paymentCycle },
              { key: 'status', header: 'الحالة', render: (row) => row.statusLabel },
              { key: 'period', header: 'الفترة', render: (row) => `${formatDate(row.startDate)} — ${formatDate(row.endDate)}` },
            ]}
            keyOf={(row) => row.contractId}
            emptyTitle="لا توجد عقود"
            emptyDescription="لا توجد عقود ضمن البيانات الحالية."
          />
        </div>
      </ReportCard>
    </div>
  );
}
