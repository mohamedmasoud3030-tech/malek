import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CollectionSummaryReport, FinancialReportFilters } from '../reports/financialReportsService';
import { formatDate, formatMoney, getErrorMessage } from './financials-formatters';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import {
  FinanceLoadingState,
  FinanceErrorState,
  FinanceCluster,
} from './finance-reporting-visual-foundations';
import { FileText, WalletCards, Receipt, TrendingDown, HandCoins, Building2 } from 'lucide-react';

type FinancialReportsPreviewSectionProps = {
  reportFilters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>;
  collectionSummary: CollectionSummaryReport | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

export function FinancialReportsPreviewSection({
  reportFilters,
  collectionSummary,
  isLoading,
  isError,
  error,
}: FinancialReportsPreviewSectionProps) {
  return (
    <Card data-finance-card data-component-card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold">التقارير المالية — ملخص الشهر</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground" data-finance-period>
          من <span dir="ltr" className="font-bold tabular-nums">{formatDate(reportFilters.dateFrom)}</span> إلى{' '}
          <span dir="ltr" className="font-bold tabular-nums">{formatDate(reportFilters.dateTo)}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <FinanceLoadingState label="جارٍ تحميل ملخص التقارير المالية..." />
        ) : null}
        {isError ? (
          <FinanceErrorState
            title="تعذر تحميل ملخص التقارير"
            description={getErrorMessage(error, 'تعذر تحميل ملخص التقارير')}
          />
        ) : null}
        {!isLoading && !isError && !collectionSummary ? (
          <div
            data-finance-empty
            data-finance-state="empty"
            className="rounded-2xl border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground"
          >
            لا توجد بيانات مالية ضمن النطاق الحالي.
          </div>
        ) : null}
        {collectionSummary ? (
          <FinanceCluster>
            <RegisterMetricStrip
              aria-label="ملخص الشهر"
              items={[
                { id: 'invoiced', label: 'الفواتير', value: formatMoney(collectionSummary.invoiced), hint: `${collectionSummary.invoicesCount} فاتورة`, icon: FileText, hideWhenEmpty: true },
                { id: 'paid', label: 'المحصّل', value: formatMoney(collectionSummary.paid), icon: HandCoins, tone: 'success' },
                { id: 'outstanding', label: 'المتبقي', value: formatMoney(collectionSummary.outstanding), icon: TrendingDown, tone: collectionSummary.outstanding > 0 ? 'danger' : 'success', hideWhenEmpty: true },
                { id: 'receipts', label: 'إيصالات', value: collectionSummary.receiptsCount, icon: Receipt, hideWhenEmpty: true },
                { id: 'expenses', label: 'مصروفات', value: formatMoney(collectionSummary.expensesTotal), icon: Building2, hideWhenEmpty: true },
              ]}
            />
          </FinanceCluster>
        ) : null}
      </CardContent>
    </Card>
  );
}
