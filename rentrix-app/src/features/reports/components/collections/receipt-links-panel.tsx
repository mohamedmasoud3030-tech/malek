import { ReceiptText } from 'lucide-react';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import { createReceiptPrintHref } from '../../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportState } from '../report-section-primitives';

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

export function ReceiptLinksPanel({ rows, isLoading }: Readonly<{ rows: ReceiptRow[]; isLoading: boolean }>) {
  return (
    <ReportPanel
      title="الإيصالات القابلة للطباعة"
      description="أحدث الإيصالات الموجودة داخل نطاق التقرير."
      icon={ReceiptText}
      isLoading={isLoading}
    >
      {rows.length === 0 ? (
        <div className="p-4"><ReportState message="لا توجد إيصالات متاحة ضمن الفترة المحددة." /></div>
      ) : (
        <ReportList>
          {rows.map((receipt) => (
            <ReportListRow
              key={receipt.id}
              title={(
                <a className="hover:text-primary hover:underline" href={createReceiptPrintHref(receipt.id)}>
                  {receipt.receipt_number}
                </a>
              )}
              subtitle={receipt.tenant_name ?? 'مستأجر غير محدد'}
              meta={formatDate(receipt.payment_date)}
              value={<span dir="ltr">{formatMoney(receipt.amount)}</span>}
            />
          ))}
        </ReportList>
      )}
    </ReportPanel>
  );
}
