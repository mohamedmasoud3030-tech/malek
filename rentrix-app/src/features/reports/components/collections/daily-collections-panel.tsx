import { WalletCards } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import { ReportPanel, ReportState } from '../report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

export function DailyCollectionsPanel({ rows, action, isLoading }: Readonly<{ rows: DailyCollectionReportRow[]; action?: React.ReactNode; isLoading: boolean }>) {
  return <ReportPanel title="التحصيل اليومي" description="إجمالي كل يوم موزعًا على طرق السداد المسجلة." icon={WalletCards} action={action} isLoading={isLoading}>
    {rows.length === 0 ? <div className="p-4"><ReportState message="لا توجد تحصيلات في الفترة المحددة." /></div> : <div className="p-4"><DataTable
      aria-label="جدول التحصيل اليومي"
      rows={rows}
      columns={[
        { key: 'date', header: 'التاريخ', priority: 'identity', render: (row) => formatDate(row.paymentDate) },
        { key: 'total', header: 'الإجمالي', priority: 'primary', render: (row) => <span className="font-bold" dir="ltr">{formatMoney(row.totalPaid)}</span> },
        { key: 'count', header: 'المدفوعات', priority: 'primary', render: (row) => formatLatinNumber(row.paymentsCount, 'ar') },
        { key: 'cash', header: 'نقدًا', priority: 'secondary', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.cash)}</span> },
        { key: 'transfer', header: 'تحويل', priority: 'secondary', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.bank_transfer)}</span> },
        { key: 'card', header: 'بطاقة', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.card)}</span> },
        { key: 'check', header: 'شيك', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.methodTotals.check)}</span> },
      ]}
      keyOf={(row) => row.paymentDate}
      emptyTitle="لا توجد تحصيلات"
      emptyDescription="لا توجد تحصيلات في الفترة المحددة."
    /></div>}
  </ReportPanel>;
}
