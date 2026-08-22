import { AlertTriangle, Clock, FileWarning, TrendingDown, WalletCards } from 'lucide-react';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
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
}: ArrearsSummaryCardsProps) {
  const totalOverdue = arrearsSummaryReport?.totalOverdue ?? overdueReport?.totalOverdue ?? 0;
  const overdueInvoiceCount = arrearsSummaryReport?.overdueInvoiceCount ?? overdueReport?.invoiceCount ?? 0;
  const averageDaysOverdue = toFinancialNumber(arrearsSummaryReport?.averageDaysOverdue);
  const over90Bucket = getAgingBucket(agedReceivablesReport, OVER_90_BUCKET_KEY);
  const over90Amount = arrearsSummaryReport?.over90Amount ?? over90Bucket?.total ?? 0;
  const totalOutstanding = agedReceivablesReport?.totalOutstanding ?? 0;

  return (
    <RegisterMetricStrip
      aria-label="ملخص المتأخرات"
      items={[
        { id: 'overdue', label: 'المتأخرات', value: formatMoney(totalOverdue), icon: AlertTriangle, tone: totalOverdue > 0 ? 'danger' : 'default', hideWhenEmpty: true },
        { id: 'count', label: 'فواتير متأخرة', value: overdueInvoiceCount, icon: FileWarning, hideWhenEmpty: true },
        { id: 'avg', label: 'متوسط التأخير', value: `${formatLatinNumber(averageDaysOverdue, ARABIC_LOCALE, { maximumFractionDigits: 1 })} يوم`, icon: Clock, hideWhenEmpty: averageDaysOverdue === 0 },
        { id: 'over90', label: '90+ يوم', value: formatMoney(over90Amount), icon: TrendingDown, tone: 'danger', hideWhenEmpty: true },
        { id: 'outstanding', label: 'المتبقي', value: formatMoney(totalOutstanding), icon: WalletCards, hideWhenEmpty: true },
      ]}
    />
  );
}
