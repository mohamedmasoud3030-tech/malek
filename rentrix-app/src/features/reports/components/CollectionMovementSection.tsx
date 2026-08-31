import { ReceiptText, WalletCards } from 'lucide-react';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import type { CollectionSummaryReport } from '@/features/financials/reports/financial-reporting/report-types';
import { ReportColumns, ReportInsightNote, ReportList, ReportListRow, ReportPanel, ReportState, ReportSummaryStrip } from '@/components/ui/report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';
import { buildReportCsvFilename, toDailyCollectionCsv } from '../reports-page.helpers';
import { DailyCollectionsPanel } from './collections/daily-collections-panel';
import { ReceiptLinksPanel, type CollectionReceiptRow } from './collections/receipt-links-panel';
import { ReportShareActions } from './ReportShareActions';

const paymentMethodLabels = {
  cash: 'نقدًا',
  bank_transfer: 'تحويل بنكي',
  card: 'بطاقة',
  check: 'شيك',
  other: 'أخرى',
} as const;

type PaymentMethodKey = keyof typeof paymentMethodLabels;

type CollectionMovementProps = Readonly<{
  summary: CollectionSummaryReport | undefined;
  rows: DailyCollectionReportRow[];
  receiptRows: CollectionReceiptRow[];
  from: string;
  to: string;
  canExportReports: boolean;
  isLoading: boolean;
}>;

/**
 * حركة التحصيل — answers "what actually moved during this period?". It stays
 * transaction/movement-oriented: daily movement, payment-method mix, receipt
 * context. It reuses the same daily-collection and receipt-link read models
 * as the period summary and adds no data source of its own.
 *
 * Semantic contract (Phase 2A parity):
 * - The authoritative collected figure is `summary.paid`; when the summary is
 *   unavailable the strip says so instead of substituting a row-derived total
 *   or a fabricated zero.
 * - Daily totals, payment counts, and the method mix are transactional
 *   aggregations of the served daily rows — movement context, never a
 *   replacement executive metric.
 * - No collection rate, invoiced, or outstanding here: those belong to the
 *   Collections executive summary.
 */
export function CollectionMovementSection({
  summary,
  rows,
  receiptRows,
  from,
  to,
  canExportReports,
  isLoading,
}: CollectionMovementProps) {
  const hasAuthoritativeSummary = Boolean(summary);
  const collectedLabel = hasAuthoritativeSummary ? formatMoney(summary!.paid) : '—';

  // Transactional movement context from the served daily rows.
  const paymentsCount = rows.reduce((total, row) => total + row.paymentsCount, 0);
  const busiestDay = rows.reduce<DailyCollectionReportRow | undefined>(
    (busiest, row) => (busiest === undefined || row.totalPaid > busiest.totalPaid ? row : busiest),
    undefined,
  );
  const methodTotals = rows.reduce(
    (totals, row) => {
      for (const key of Object.keys(totals) as PaymentMethodKey[]) totals[key] += row.methodTotals[key];
      return totals;
    },
    { cash: 0, bank_transfer: 0, card: 0, check: 0, other: 0 },
  );
  const methodMovementTotal = Object.values(methodTotals).reduce((total, value) => total + value, 0);
  const methodRows = (Object.entries(methodTotals) as Array<[PaymentMethodKey, number]>)
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1]);
  const hasMovement = rows.length > 0 || receiptRows.length > 0;

  const movementActions = canExportReports ? (
    <ReportShareActions
      className="flex flex-wrap gap-2"
      reportLabel="حركة التحصيل اليومية"
      target={{
        section: 'analytics',
        view: 'collection_movement',
        filters: {
          from,
          to,
          asOf: to,
          propertyId: '',
          unitId: '',
          tenantId: '',
          ownerId: '',
          contractId: '',
        },
      }}
      summaryText={hasAuthoritativeSummary
        ? `المحصّل في الفترة: ${collectedLabel} | عدد الدفعات: ${formatLatinNumber(paymentsCount, 'ar')}`
        : `عدد الدفعات المعروضة: ${formatLatinNumber(paymentsCount, 'ar')} | ملخص الفترة المعتمد غير متاح`}
      csv={{ filename: buildReportCsvFilename('collection-movement'), rows: toDailyCollectionCsv(rows) }}
    />
  ) : undefined;

  return (
    <div className="space-y-4">
      <ReportPanel
        title="حركة التحصيل"
        description="التحصيل اليومي حسب طرق السداد وأحدث الإيصالات المرتبطة — نفس مصدر ملخص الفترة."
        eyebrow="تدفق نقدي تشغيلي"
        icon={ReceiptText}
        action={movementActions}
        isLoading={isLoading}
      >
        <div className="px-4 py-3 sm:px-5">
          <ReportSummaryStrip
            dataReportSummary="collection-movement"
            items={[
              {
                label: 'المحصّل في الفترة',
                value: collectedLabel,
                detail: hasAuthoritativeSummary ? 'قيمة معتمدة من ملخص الفترة' : 'الملخص المعتمد غير متاح',
                tone: hasAuthoritativeSummary ? 'good' : undefined,
              },
              {
                label: 'عدد الدفعات',
                value: formatLatinNumber(paymentsCount, 'ar'),
                detail: `${formatLatinNumber(rows.length, 'ar')} يوم نشط`,
              },
              {
                label: 'أعلى يوم تحصيلًا',
                value: busiestDay ? formatMoney(busiestDay.totalPaid) : '—',
                detail: busiestDay ? formatDate(busiestDay.paymentDate) : 'لا توجد حركة',
              },
              {
                label: 'الإيصالات المعروضة',
                value: formatLatinNumber(receiptRows.length, 'ar'),
                detail: 'سياق الإيصالات المرتبطة',
              },
            ]}
          />
        </div>
        {!hasMovement ? (
          <div className="p-4 pt-0">
            <ReportState message="لا توجد حركة تحصيل في الفترة المحددة." />
          </div>
        ) : null}
      </ReportPanel>

      <DailyCollectionsPanel rows={rows} isLoading={isLoading} />

      <ReportColumns>
        <ReportPanel
          title="حركة طرق السداد"
          description="توزيع مبالغ الفترة على طرق السداد كما وردت في جدول التحصيل اليومي."
          icon={WalletCards}
          isLoading={isLoading}
        >
          {methodRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد دفعات مسجلة لعرض توزيع طرق السداد." /></div>
          ) : (
            <ReportList>
              {methodRows.map(([method, total]) => {
                const share = methodMovementTotal > 0 ? Math.round((total / methodMovementTotal) * 100) : 0;
                return (
                  <ReportListRow
                    key={method}
                    title={paymentMethodLabels[method]}
                    subtitle={`${formatLatinNumber(share, 'ar')}٪ من حركة الفترة المعروضة`}
                    meta={(
                      <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, share)}%` }} />
                      </span>
                    )}
                    value={<span dir="ltr">{formatMoney(total)}</span>}
                  />
                );
              })}
            </ReportList>
          )}
        </ReportPanel>

        <div className="space-y-4">
          <ReceiptLinksPanel rows={receiptRows} isLoading={isLoading} />
          <ReportInsightNote title="قراءة الحركة">
            {!hasMovement
              ? 'لا توجد دفعات أو إيصالات في هذه الفترة؛ وسّع النطاق الزمني أو راجع فلاتر النطاق.'
              : busiestDay
                ? `أعلى حركة سُجلت يوم ${formatDate(busiestDay.paymentDate)} بقيمة ${formatMoney(busiestDay.totalPaid)}${methodRows[0] ? `، وأكثر طرق السداد استخدامًا ${paymentMethodLabels[methodRows[0][0]]}` : ''}. مؤشرات الفوترة والكفاءة التنفيذية تبقى في ملخص التحصيل.`
                : 'لا يوجد جدول تحصيل يومي ضمن الفترة، لكن توجد إيصالات معروضة أدناه.'}
          </ReportInsightNote>
        </div>
      </ReportColumns>
    </div>
  );
}

export type { CollectionMovementProps };
