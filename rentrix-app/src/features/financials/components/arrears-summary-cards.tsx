import { AlertTriangle, Clock, FileWarning, TrendingDown, WalletCards } from 'lucide-react';
import { toFinancialNumber } from '../financialMath';
import type {
  AgedReceivablesBucket,
  AgedReceivablesReport,
  AgingBucketKey,
  ArrearsSummaryReport,
  OverdueInvoicesReport,
} from '../reports/financialReportsService';
import { ARABIC_LOCALE, OVER_90_BUCKET_KEY } from './arrears-workflow-helpers';
import { formatMoney } from './financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';
import { FinanceKpiGrid, FinanceKpiCard } from './finance-reporting-visual-foundations';

function getAgingBucket(report: AgedReceivablesReport | undefined, key: AgingBucketKey): AgedReceivablesBucket | undefined {
  return report?.buckets?.[key];
}

type ArrearsSummaryCardsProps = Readonly<{
  overdueReport: OverdueInvoicesReport | undefined;
  agedReceivablesReport: AgedReceivablesReport | undefined;
  arrearsSummaryReport: ArrearsSummaryReport | undefined;
  onDrill?: (filter: { status?: string; aging?: string }) => void;
}>;

export function ArrearsSummaryCards({
  overdueReport,
  agedReceivablesReport,
  arrearsSummaryReport,
  onDrill,
}: ArrearsSummaryCardsProps) {
  const totalOverdue = arrearsSummaryReport?.totalOverdue ?? overdueReport?.totalOverdue ?? 0;
  const overdueInvoiceCount = arrearsSummaryReport?.overdueInvoiceCount ?? overdueReport?.invoiceCount ?? 0;
  const averageDaysOverdue = toFinancialNumber(arrearsSummaryReport?.averageDaysOverdue);
  const over90Bucket = getAgingBucket(agedReceivablesReport, OVER_90_BUCKET_KEY);
  const over90Amount = arrearsSummaryReport?.over90Amount ?? over90Bucket?.total ?? 0;
  const totalOutstanding = agedReceivablesReport?.totalOutstanding ?? 0;

  return (
    <FinanceKpiGrid desktopColumns={5} aria-label="ملخص المتأخرات">
      <FinanceKpiCard
        label="إجمالي المتأخرات"
        value={formatMoney(totalOverdue)}
        sub="مبالغ متأخرة"
        icon={AlertTriangle}
        accent="primary"
        trend="down"
        trendValue="متأخر"
        onDrill={onDrill ? () => onDrill({ status: 'overdue' }) : undefined}
        drillAriaLabel={`إجمالي المتأخرات ${totalOverdue} — عرض الفواتير المتأخرة`}
        unit="OMR"
      />
      <FinanceKpiCard
        label="فواتير متأخرة"
        value={overdueInvoiceCount}
        sub="عدد الفواتير"
        icon={FileWarning}
        accent="primary"
        onDrill={onDrill ? () => onDrill({ status: 'overdue' }) : undefined}
      />
      <FinanceKpiCard
        label="متوسط أيام التأخير"
        value={`${formatLatinNumber(averageDaysOverdue, ARABIC_LOCALE, { maximumFractionDigits: 1 })} يوم`}
        sub="متوسط التأخير"
        icon={Clock}
        accent="primary"
      />
      <FinanceKpiCard
        label="متأخرات 90+ يوم"
        value={formatMoney(over90Amount)}
        sub="أعمار ديون طويلة"
        icon={TrendingDown}
        accent="primary"
        trend="down"
        trendValue="90+"
        onDrill={onDrill ? () => onDrill({ aging: '90+' }) : undefined}
        unit="OMR"
      />
      <FinanceKpiCard
        label="إجمالي المتبقي الموجب"
        value={formatMoney(totalOutstanding)}
        sub="قابل للتحصيل"
        icon={WalletCards}
        accent="primary"
        trend="neutral"
        trendValue="متبقي"
        unit="OMR"
      />
    </FinanceKpiGrid>
  );
}
