import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import type { AgedReceivablesReport, ArrearsSummaryReport, OverdueInvoicesReport } from '../reports/financialReportsService';
import { ArrearsAgingBuckets } from './arrears-aging-buckets';
import { ArrearsFilters } from './arrears-filters';
import { ArrearsSummaryCards } from './arrears-summary-cards';
import { filterOverdueInvoiceRows, type ArrearsBucketFilter } from './arrears-workflow-helpers';
import { formatDate, getErrorMessage } from './financials-formatters';
import { OverdueInvoicesTable } from './overdue-invoices-table';

type ArrearsWorkflowSectionProps = Readonly<{
  asOf: string;
  search: string;
  bucketFilter: ArrearsBucketFilter;
  overdueReport: OverdueInvoicesReport | undefined;
  agedReceivablesReport: AgedReceivablesReport | undefined;
  arrearsSummaryReport: ArrearsSummaryReport | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onAsOfChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onBucketFilterChange: (value: ArrearsBucketFilter) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onCollectInvoice?: (invoiceId: string) => void;
}>;

export function ArrearsWorkflowSection({
  asOf,
  search,
  bucketFilter,
  overdueReport,
  agedReceivablesReport,
  arrearsSummaryReport,
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
  const canShowReportContent = !isError;
  const canShowRows = !isLoading && !isError;
  const hasOverdueRows = overdueRows.length > 0;
  const hasFilteredRows = filteredRows.length > 0;

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <CardTitle>متابعة تحصيل المتأخرات</CardTitle>
        <p className="text-sm text-muted-foreground">
          متابعة الفواتير المتأخرة وأعمار الذمم حتى {formatDate(asOf)}، مع الانتقال للتحصيل عندما تسمح الصلاحية.
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

        {isLoading ? (
          <LoadingState variant="section" label="جارٍ تحميل بيانات المتأخرات" />
        ) : null}
        {isError ? (
          <ErrorState
            title="تعذر تحميل تقارير المتأخرات"
            description={getErrorMessage(error, 'إعادة المحاولة أو تحديث الصفحة آمن ولن ينفّذ أي عملية دفع.')}
            onRetry={undefined}
          />
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
          <OverdueInvoicesTable rows={filteredRows} onSelectInvoice={onSelectInvoice} onCollectInvoice={onCollectInvoice} />
        ) : null}
      </CardContent>
    </Card>
  );
}
