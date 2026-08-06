import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CollectionSummaryReport, FinancialReportFilters } from '../reports/financialReportsService';
import { formatDate, formatMoney, getErrorMessage } from './financials-formatters';
import {
  FinanceKpiGrid,
  FinanceKpiCard,
  FinanceLoadingState,
  FinanceErrorState,
  FinanceAmount,
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
            <FinanceKpiGrid desktopColumns={6}>
              <FinanceKpiCard
                label="الفواتير"
                value={formatMoney(collectionSummary.invoiced)}
                sub={`${collectionSummary.invoicesCount} فاتورة`}
                icon={FileText}
                accent="primary"
                drillTo="/finance/collections"
                drillSearch={{ section: 'invoices', dateFrom: reportFilters.dateFrom, dateTo: reportFilters.dateTo }}
                drillAriaLabel="الفواتير: عرض قائمة الفواتير ضمن نفس الفترة"
                unit="OMR"
              />
              <FinanceKpiCard
                label="المدفوع"
                value={formatMoney(collectionSummary.paid)}
                sub="من الإجمالي"
                icon={HandCoins}
                accent="primary"
                trend="up"
                trendValue="محصّل"
                drillTo="/finance/collections"
                drillSearch={{ section: 'receipts', dateFrom: reportFilters.dateFrom, dateTo: reportFilters.dateTo }}
                unit="OMR"
              />
              <FinanceKpiCard
                label="المتبقي"
                value={formatMoney(collectionSummary.outstanding)}
                sub="يحتاج متابعة"
                icon={TrendingDown}
                accent="primary"
                trend="down"
                trendValue="مستحق"
                drillTo="/finance/expenses"
                drillSearch={{ section: 'arrears' }}
                unit="OMR"
              />
              <FinanceKpiCard
                label="الإيصالات"
                value={collectionSummary.receiptsCount}
                sub="سندات قبض"
                icon={Receipt}
                accent="primary"
                drillTo="/finance/collections"
                drillSearch={{ section: 'receipts' }}
              />
              <FinanceKpiCard
                label="عدد الفواتير"
                value={collectionSummary.invoicesCount}
                sub="ضمن الفترة"
                icon={FileText}
                accent="primary"
                drillTo="/finance/collections"
                drillSearch={{ section: 'invoices' }}
              />
              <FinanceKpiCard
                label="المصاريف"
                value={formatMoney(collectionSummary.expensesTotal)}
                sub="تشغيلية"
                icon={Building2}
                accent="primary"
                drillTo="/finance/expenses"
                drillSearch={{ section: 'expenses', from: reportFilters.dateFrom, to: reportFilters.dateTo }}
                unit="OMR"
              />
            </FinanceKpiGrid>

            <div
              data-finance-amounts
              className="grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs sm:grid-cols-3"
              aria-label="تفاصيل المبالغ"
            >
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">إجمالي الفواتير:</span>
                <FinanceAmount>{formatMoney(collectionSummary.invoiced)}</FinanceAmount>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">المحصّل:</span>
                <FinanceAmount className="text-success">{formatMoney(collectionSummary.paid)}</FinanceAmount>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">المتبقي:</span>
                <FinanceAmount className="text-destructive">{formatMoney(collectionSummary.outstanding)}</FinanceAmount>
              </div>
            </div>
          </FinanceCluster>
        ) : null}
      </CardContent>
    </Card>
  );
}
