import { Download, Printer, UserRound, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney, formatShortId, getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import { createReceiptPrintHref } from '../../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportPanelSkeleton, ReportState } from '../report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

type TenantFallbackRow = Readonly<{
  contractId: string;
  tenantName: string | null;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
}>;

type OwnerFallbackRow = Readonly<{
  propertyId: string;
  propertyTitle: string | null;
  total: number;
  count: number;
}>;

export function TenantStatementPanel({
  selectedContractId,
  statement,
  error,
  isLoading,
  fallbackRows,
  receipts,
  onPrint,
  onDownloadPdf,
  actionsDisabled = false,
}: Readonly<{
  selectedContractId: string;
  statement: TenantStatementReport | undefined;
  error: unknown;
  isLoading: boolean;
  fallbackRows: TenantFallbackRow[];
  receipts: ReceiptRow[];
  onPrint: () => void;
  onDownloadPdf: () => void;
  actionsDisabled?: boolean;
}>) {
  return (
    <ReportPanel
      title="كشف حساب المستأجر"
      description="دفتر الحركة الحقيقي للعقد المحدد مع الذمم والإيصالات."
      icon={UserRound}
      action={statement ? (
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onPrint} disabled={actionsDisabled} className="min-h-10 gap-1.5 text-xs">
            <Printer className="size-3.5" aria-hidden="true" />
            طباعة الكشف
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDownloadPdf} disabled={actionsDisabled} className="min-h-10 gap-1.5 text-xs">
            <Download className="size-3.5" aria-hidden="true" />
            تنزيل PDF
          </Button>
        </div>
      ) : undefined}
    >
      {isLoading ? (
        <ReportPanelSkeleton />
      ) : error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل كشف المستأجر من RPC.')} /></div>
      ) : selectedContractId && statement?.error ? (
        <div className="p-4"><ReportState message={statement.error} /></div>
      ) : selectedContractId && statement && statement.lines.length > 0 ? (
        <>
          <div className="border-b border-border/60 bg-muted/20 p-4">
            <p className="text-sm font-bold">{statement.tenantName ?? 'مستأجر غير محدد'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{statement.propertyName ?? '—'} · {statement.unitName ?? '—'}</p>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">الرصيد النهائي</span>
              <span className="font-bold" dir="ltr">{formatMoney(statement.finalBalance)}</span>
            </div>
          </div>
          <ReportList>
            {statement.lines.slice(0, 8).map((line, index) => (
              <ReportListRow
                key={`${line.date}-${index}`}
                title={line.description ?? line.type ?? 'حركة'}
                subtitle={line.date ?? '—'}
                meta={`مدين ${formatMoney(line.debit)} · دائن ${formatMoney(line.credit)}`}
                value={<span dir="ltr">{formatMoney(line.debit - line.credit)}</span>}
              />
            ))}
          </ReportList>
        </>
      ) : selectedContractId ? (
        <div className="p-4"><ReportState message="لا توجد حركات في كشف المستأجر لهذا العقد." /></div>
      ) : fallbackRows.length > 0 ? (
        <ReportList>
          {fallbackRows.map((row) => (
            <ReportListRow
              key={row.contractId}
              title={row.tenantName ?? 'مستأجر غير محدد'}
              subtitle={`${formatLatinNumber(row.invoiceCount, 'ar')} فواتير · عقد ${formatShortId(row.contractId)}`}
              meta={`متأخر ${formatMoney(row.totalOverdue)}`}
              value={<span dir="ltr">{formatMoney(row.totalOutstanding)}</span>}
            />
          ))}
          {receipts.slice(0, 3).map((receipt) => (
            <ReportListRow
              key={`receipt-${receipt.id}`}
              title={<a className="hover:text-primary hover:underline" href={createReceiptPrintHref(receipt.id)}>{receipt.receipt_number}</a>}
              subtitle={receipt.tenant_name ?? 'مستأجر غير محدد'}
              value={<span dir="ltr">{formatMoney(receipt.amount)}</span>}
            />
          ))}
        </ReportList>
      ) : (
        <div className="p-4"><ReportState message="اختر عقدًا من فلاتر التقرير لعرض كشف المستأجر الحقيقي." /></div>
      )}
    </ReportPanel>
  );
}

export function OwnerStatementPanel({
  selectedOwnerId,
  statement,
  error,
  isLoading,
  fallbackRows,
  onPrint,
  onDownloadPdf,
  actionsDisabled = false,
}: Readonly<{
  selectedOwnerId: string;
  statement: OwnerStatementReport | undefined;
  error: unknown;
  isLoading: boolean;
  fallbackRows: OwnerFallbackRow[];
  onPrint: () => void;
  onDownloadPdf: () => void;
  actionsDisabled?: boolean;
}>) {
  return (
    <ReportPanel
      title="كشف حساب المالك"
      description="الإيرادات والاستقطاعات وصافي الحركة للمالك المحدد."
      icon={UsersRound}
      action={statement ? (
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onPrint} disabled={actionsDisabled} className="min-h-10 gap-1.5 text-xs">
            <Printer className="size-3.5" aria-hidden="true" />
            طباعة الكشف
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDownloadPdf} disabled={actionsDisabled} className="min-h-10 gap-1.5 text-xs">
            <Download className="size-3.5" aria-hidden="true" />
            تنزيل PDF
          </Button>
        </div>
      ) : undefined}
    >
      {isLoading ? (
        <ReportPanelSkeleton />
      ) : error ? (
        <div className="p-4"><ReportState kind="error" message={getErrorMessage(error, 'تعذر تحميل كشف المالك من RPC.')} /></div>
      ) : selectedOwnerId && statement?.error ? (
        <div className="p-4"><ReportState message={statement.error} /></div>
      ) : selectedOwnerId && statement && statement.transactions.length > 0 ? (
        <>
          <div className="border-b border-border/60 bg-muted/20 p-4">
            <p className="text-sm font-bold">{statement.ownerName ?? 'مالك غير محدد'}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-muted-foreground">الإجمالي</p><p className="mt-1 font-bold" dir="ltr">{formatMoney(statement.totalGross)}</p></div>
              <div><p className="text-muted-foreground">الاستقطاعات</p><p className="mt-1 font-bold" dir="ltr">{formatMoney(statement.totalDeductions)}</p></div>
              <div><p className="text-muted-foreground">الصافي</p><p className="mt-1 font-bold" dir="ltr">{formatMoney(statement.totalNet)}</p></div>
            </div>
          </div>
          <ReportList>
            {statement.transactions.slice(0, 8).map((transaction, index) => (
              <ReportListRow
                key={`${transaction.date}-${index}`}
                title={transaction.details ?? transaction.type ?? 'حركة'}
                subtitle={transaction.date ?? '—'}
                value={<span dir="ltr">{formatMoney(transaction.net)}</span>}
              />
            ))}
          </ReportList>
        </>
      ) : selectedOwnerId ? (
        <div className="p-4"><ReportState message="لا توجد حركات في كشف المالك للفترة المحددة." /></div>
      ) : fallbackRows.length > 0 ? (
        <ReportList>
          {fallbackRows.map((row) => (
            <ReportListRow
              key={row.propertyId}
              title={row.propertyTitle ?? formatShortId(row.propertyId)}
              subtitle={`${formatLatinNumber(row.count, 'ar')} حركة مصروفات`}
              value={<span dir="ltr">{formatMoney(row.total)}</span>}
            />
          ))}
        </ReportList>
      ) : (
        <div className="p-4"><ReportState message="اختر مالكًا من فلاتر التقرير لعرض كشف المالك الحقيقي." /></div>
      )}
    </ReportPanel>
  );
}
