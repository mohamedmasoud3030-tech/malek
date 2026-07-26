import { AlertTriangle, Clock, FileWarning, TrendingDown, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { toFinancialNumber } from '../financialMath';
import type { AgedReceivablesBucket, AgedReceivablesReport, AgingBucketKey, ArrearsSummaryReport, OverdueInvoicesReport } from '../reports/financialReportsService';
import { ARABIC_LOCALE, OVER_90_BUCKET_KEY } from './arrears-workflow-helpers';
import { formatMoney } from './financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';

function getAgingBucket(report: AgedReceivablesReport | undefined, key: AgingBucketKey): AgedReceivablesBucket | undefined {
  return report?.buckets?.[key];
}

type ArrearsSummaryCardsProps = Readonly<{
  overdueReport: OverdueInvoicesReport | undefined;
  agedReceivablesReport: AgedReceivablesReport | undefined;
  arrearsSummaryReport: ArrearsSummaryReport | undefined;
}>;

export function ArrearsSummaryCards({ overdueReport, agedReceivablesReport, arrearsSummaryReport }: ArrearsSummaryCardsProps) {
  const totalOverdue = arrearsSummaryReport?.totalOverdue ?? overdueReport?.totalOverdue ?? 0;
  const overdueInvoiceCount = arrearsSummaryReport?.overdueInvoiceCount ?? overdueReport?.invoiceCount ?? 0;
  const averageDaysOverdue = toFinancialNumber(arrearsSummaryReport?.averageDaysOverdue);
  const over90Bucket = getAgingBucket(agedReceivablesReport, OVER_90_BUCKET_KEY);
  const over90Amount = arrearsSummaryReport?.over90Amount ?? over90Bucket?.total ?? 0;
  const totalOutstanding = agedReceivablesReport?.totalOutstanding ?? 0;

  return (
    <ResponsiveCardGrid desktopColumns={5}>
      <KpiCard label="إجمالي المتأخرات" value={formatMoney(totalOverdue)} icon={AlertTriangle} accent="rose" />
      <KpiCard label="فواتير متأخرة" value={overdueInvoiceCount} icon={FileWarning} accent="amber" />
      <KpiCard
        label="متوسط أيام التأخير"
        value={`${formatLatinNumber(averageDaysOverdue, ARABIC_LOCALE, { maximumFractionDigits: 1 })} يوم`}
        icon={Clock}
        accent="amber"
      />
      <KpiCard label="متأخرات 90+ يوم" value={formatMoney(over90Amount)} icon={TrendingDown} accent="rose" />
      <KpiCard label="إجمالي المتبقي الموجب" value={formatMoney(totalOutstanding)} icon={WalletCards} accent="primary" />
    </ResponsiveCardGrid>
  );
}
