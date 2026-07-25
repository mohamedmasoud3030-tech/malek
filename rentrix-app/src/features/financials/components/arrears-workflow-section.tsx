import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgedReceivablesReport, ArrearsSummaryReport, OverdueInvoicesReport } from '../reports/financialReportsService';
import { ArrearsAgingBuckets } from './arrears-aging-buckets';
import { ArrearsFilters } from './arrears-filters';
import { ArrearsSummaryCards } from './arrears-summary-cards';
import { filterOverdueInvoiceRows, type ArrearsBucketFilter } from './arrears-workflow-helpers';
import { formatDate, getErrorMessage } from './financials-formatters';
import { OverdueInvoicesTable, SelectedOverdueInvoiceCard } from './overdue-invoices-table';

type ArrearsWorkflowSectionProps = Readonly<{
  asOf: string;
  search: string;
  bucketFilter: ArrearsBucketFilter;
  overdueReport: OverdueInvoicesReport | undefined;
  agedReceivablesReport: AgedReceivablesReport | undefined;
  arrearsSummaryReport: ArrearsSummaryReport | undefined;
  selectedInvoiceId: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onAsOfChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onBucketFilterChange: (value: ArrearsBucketFilter) => void;
  onSelectInvoice: (invoiceId: string) => void;
  /** Optional «تحصيل» deep-link action, supplied when the user may record payments. */
  onCollectInvoice?: (invoiceId: string) => void;
}>;

export function ArrearsWorkflowSection({
  asOf,
  search,
  bucketFilter,
  overdueReport,
  agedReceivablesReport,
  arrearsSummaryReport,
  selectedInvoiceId,
  isLoading,
  isError,
  error,
  onAsOfChange,
  onSearchChange,
  onBucketFilterChange,
  onSelectInvoice,
  onCollectInvoice,
}: ArrearsWorkflowSectionProps) {
  const overdueRows = overdueReport?.rows ?? [];
  const filteredRows = filterOverdueInvoiceRows(overdueRows, search, bucketFilter);
  const selectedOverdueRow = overdueRows.find((row) => row.invoiceId === selectedInvoiceId);
  const hasFilters = search.trim().length > 0 || bucketFilter !== 'all';
  const canShowReportContent = !isError;
  const canShowRows = !isLoading && !isError;
  const hasOverdueRows = overdueRows.length > 0;
  const hasFilteredRows = filteredRows.length > 0;

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <CardTitle>Workflow تحصيل المتأخرات</CardTitle>
        <p className="text-sm text-muted-foreground">
          سطح قراءة فقط لمتابعة المتأخرات حسب تاريخ الاستحقاق حتى {formatDate(asOf)} دون تنفيذ مدفوعات أو إرسال رسائل.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <ArrearsFilters
          asOf={asOf}
          search={search}
          bucketFilter={bucketFilter}
          onAsOfChange={onAsOfChange}
          onSearchChange={onSearchChange}
          onBucketFilterChange={onBucketFilterChange}
        />

        {isLoading ? <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">جارٍ تحميل معاينة تحصيل المتأخرات للقراءة فقط...</div> : null}
        {isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-destructive">
            {getErrorMessage(error, 'تعذر تحميل تقارير المتأخرات. إعادة المحاولة أو تحديث الصفحة آمن ولن ينفّذ أي عملية دفع.')}
          </div>
        ) : null}

        {canShowReportContent ? (
          <>
            <ArrearsSummaryCards overdueReport={overdueReport} agedReceivablesReport={agedReceivablesReport} arrearsSummaryReport={arrearsSummaryReport} />
            <ArrearsAgingBuckets agedReceivablesReport={agedReceivablesReport} />
          </>
        ) : null}

        {canShowRows && !hasOverdueRows ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">لا توجد فواتير متأخرة حتى تاريخ التقرير الحالي.</div>
        ) : null}

        {canShowRows && hasOverdueRows && !hasFilteredRows ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">لا توجد صفوف مطابقة لفلاتر التحصيل الحالية.</div>
        ) : null}

        {canShowRows && hasFilteredRows ? (
          <OverdueInvoicesTable rows={filteredRows} selectedInvoiceId={selectedInvoiceId} onSelectInvoice={onSelectInvoice} onCollectInvoice={onCollectInvoice} />
        ) : null}

        {canShowRows && (hasOverdueRows || hasFilters) ? (
          <SelectedOverdueInvoiceCard row={selectedOverdueRow} onShowInvoice={onSelectInvoice} onCollectInvoice={onCollectInvoice} />
        ) : null}
      </CardContent>
    </Card>
  );
}
