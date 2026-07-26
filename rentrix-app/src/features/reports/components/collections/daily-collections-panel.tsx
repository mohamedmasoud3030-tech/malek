import { WalletCards } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import { ReportPanel, ReportState } from '../report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

export function DailyCollectionsPanel({
  rows,
  action,
  isLoading,
}: Readonly<{
  rows: DailyCollectionReportRow[];
  action?: React.ReactNode;
  isLoading: boolean;
}>) {
  return (
    <ReportPanel
      title="التحصيل اليومي"
      description="إجمالي كل يوم موزعًا على طرق السداد المسجلة."
      icon={WalletCards}
      action={action}
      isLoading={isLoading}
    >
      {rows.length === 0 ? (
        <div className="p-4"><ReportState message="لا توجد تحصيلات في الفترة المحددة." /></div>
      ) : (
        <>
          <div className="grid gap-3 p-4 md:hidden">
            {rows.map((row) => (
              <MobileCard
                key={row.paymentDate}
                title={formatDate(row.paymentDate)}
                subtitle={`${formatLatinNumber(row.paymentsCount, 'ar')} مدفوعات`}
                stats={<span className="text-base font-bold" dir="ltr">{formatMoney(row.totalPaid)}</span>}
                meta={(
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                    <span>نقدًا: <strong className="text-foreground" dir="ltr">{formatMoney(row.methodTotals.cash)}</strong></span>
                    <span>تحويل: <strong className="text-foreground" dir="ltr">{formatMoney(row.methodTotals.bank_transfer)}</strong></span>
                    <span>بطاقة: <strong className="text-foreground" dir="ltr">{formatMoney(row.methodTotals.card)}</strong></span>
                    <span>شيك: <strong className="text-foreground" dir="ltr">{formatMoney(row.methodTotals.check)}</strong></span>
                  </div>
                )}
              />
            ))}
          </div>

          <div className="hidden px-4 pb-4 md:block">
            <DataTable
              aria-label="جدول التحصيل اليومي"
              rows={rows}
              columns={[
                { key: 'date', header: 'التاريخ', render: (row) => formatDate(row.paymentDate) },
                { key: 'total', header: 'الإجمالي', render: (row) => <span className="font-bold" dir="ltr">{formatMoney(row.totalPaid)}</span> },
                { key: 'count', header: 'المدفوعات', render: (row) => formatLatinNumber(row.paymentsCount, 'ar') },
                { key: 'cash', header: 'نقدًا', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.cash)}</span> },
                { key: 'transfer', header: 'تحويل', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.bank_transfer)}</span> },
                { key: 'card', header: 'بطاقة', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.card)}</span> },
                { key: 'check', header: 'شيك', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.check)}</span> },
              ]}
              keyOf={(row) => row.paymentDate}
              emptyTitle="لا توجد تحصيلات"
              emptyDescription="لا توجد تحصيلات في الفترة المحددة."
            />
          </div>
        </>
      )}
    </ReportPanel>
  );
}
