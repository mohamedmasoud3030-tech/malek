import type { AgedReceivablesReport } from '../reports/financialReportsService';
import { ARABIC_LOCALE, EMPTY_FIELD_VALUE, arrearsBucketKeys, getArrearsBucketLabel, safePercentage } from './arrears-workflow-helpers';
import { formatMoney } from './financials-formatters';

type ArrearsAgingBucketsProps = Readonly<{
  agedReceivablesReport: AgedReceivablesReport | undefined;
}>;

function formatPercentage(value: number | null) {
  if (value === null) return EMPTY_FIELD_VALUE;
  return `${value.toLatinLocaleString(ARABIC_LOCALE, { maximumFractionDigits: 1 })}%`;
}

export function ArrearsAgingBuckets({ agedReceivablesReport }: ArrearsAgingBucketsProps) {
  const totalOutstanding = agedReceivablesReport?.totalOutstanding ?? 0;

  return (
    <div className="rounded-3xl border bg-muted/20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black">أعمار الذمم المدينة</h3>
          <p className="text-xs text-muted-foreground">النسب محسوبة من إجمالي المتبقي الموجب عند توفره.</p>
        </div>
        <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-muted-foreground">الإجمالي {formatMoney(totalOutstanding)}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {arrearsBucketKeys.map((bucketKey) => {
          const bucket = agedReceivablesReport?.buckets[bucketKey];
          const amount = bucket?.total ?? 0;
          const count = bucket?.invoiceCount ?? 0;
          const percentage = safePercentage(amount, totalOutstanding);
          return (
            <div key={bucketKey} className="rounded-2xl border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black">{getArrearsBucketLabel(bucketKey)}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">{formatPercentage(percentage)}</span>
              </div>
              <p className="mt-3 text-lg font-black">{formatMoney(amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{count.toLatinLocaleString(ARABIC_LOCALE)} فاتورة</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
