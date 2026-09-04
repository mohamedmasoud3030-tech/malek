import { useMemo } from 'react';
import { AlertTriangle, FileText, TrendingDown } from 'lucide-react';
import { useDialogNavigate } from '@/app/router/background-location';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
import { buildReportCsvFilename, downloadCsv, type ExpiringContractRow } from '../reports-page.helpers';
import { ReportInsightNote, ReportList, ReportListRow, ReportPanel, ReportState, ReportSummaryStrip } from '@/components/ui/report-section-primitives';

type ExpiringContractsSectionProps = Readonly<{
  expiringRows: ExpiringContractRow[];
  vacancyAnalytics: VacancyAnalytics;
  canExportReports: boolean;
  isLoading: boolean;
}>;

function urgencyTone(daysRemaining: number): 'danger' | 'warning' | 'info' {
  if (daysRemaining <= 15) return 'danger';
  if (daysRemaining <= 30) return 'warning';
  return 'info';
}

function urgencyLabel(daysRemaining: number): string {
  if (daysRemaining <= 7) return 'عاجل';
  if (daysRemaining <= 15) return 'قريب جدًا';
  if (daysRemaining <= 30) return 'يتطلب متابعة';
  return 'ضمن النطاق';
}

/**
 * العقود القريبة من الانتهاء — deterministic leasing-risk view: days until
 * expiry, current contract value, vacancy duration and reference rent
 * exposure. No renewal probability or predictive score is computed anywhere.
 *
 * Reference rent for vacant units is an opportunity value — it is NOT an
 * invoice, NOT an outstanding balance, and NOT a receivable.
 */
export function ExpiringContractsSection({
  expiringRows,
  vacancyAnalytics,
  canExportReports,
  isLoading,
}: ExpiringContractsSectionProps) {
  const dialogNavigate = useDialogNavigate();

  const exposedIncome = useMemo(() => {
    const expiringRent = expiringRows.reduce((total, row) => total + row.monthlyRent, 0);
    const vacantRent = vacancyAnalytics.vacantRows.reduce(
      (total, row) => total + (row.referenceRent ?? 0),
      0,
    );
    return { expiringRent, vacantRent, total: expiringRent + vacantRent };
  }, [expiringRows, vacancyAnalytics.vacantRows]);

  const urgentCount = useMemo(
    () => expiringRows.filter((row) => row.daysRemaining <= 15).length,
    [expiringRows],
  );

  const exportAction = canExportReports ? (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11 shrink-0 gap-2 text-xs"
      onClick={() => downloadCsv(
        buildReportCsvFilename('expiring-contracts'),
        expiringRows.map((row) => ({
          tenant: row.tenantName,
          property: row.propertyTitle,
          unit: row.unitNumber,
          endDate: row.endDate,
          daysRemaining: row.daysRemaining,
          monthlyRent: row.monthlyRent,
          urgency: urgencyLabel(row.daysRemaining),
        })),
      )}
      disabled={expiringRows.length === 0}
    >
      <FileText className="size-4" aria-hidden="true" />
      CSV
    </Button>
  ) : undefined;

  return (
    <div className="space-y-3">
      <ReportSummaryStrip
        dataReportSummary="expiring-income-risk"
        items={[
          { label: 'عقود تنتهي قريبًا', value: formatLatinNumber(expiringRows.length, 'ar'), detail: urgentCount > 0 ? `${formatLatinNumber(urgentCount, 'ar')} عاجل (≤15 يوم)` : 'لا يوجد عاجل', tone: urgentCount > 0 ? 'critical' : expiringRows.length > 0 ? 'warning' : undefined },
          { label: 'إيجار عقود قريبة من الانتهاء', value: formatMoney(exposedIncome.expiringRent), detail: 'إيجار شهري تعاقدي فعلي' },
          { label: 'إيجار مرجعي للشواغر', value: formatMoney(exposedIncome.vacantRent), detail: 'قيمة فرصة ضائعة — ليس مستحقًا' },
          { label: 'إجمالي الانكشاف المرجعي', value: formatMoney(exposedIncome.total), detail: 'مرجعي للتخطيط لا محاسبي' },
        ]}
      />

      <ReportInsightNote title="قراءة الانكشاف التأجيري">
        إيجار العقود القريبة من الانتهاء هو إيجار تعاقدي فعلي معرض للتوقف عند انتهاء العقد. إيجار الوحدات الشاغرة هو سعر مرجعي يمثّل فرصة ضائعة وليس فاتورة أو رصيدًا مستحقًا. الأرقام للتخطيط واتخاذ قرار التجديد أو التأجير، وليست قيدًا محاسبيًا.
      </ReportInsightNote>

      <ReportPanel
        title="العقود القريبة من الانتهاء"
        description={`عقود نشطة تنتهي خلال 60 يومًا، مرتبة من الأقرب انتهاءً — ${formatLatinNumber(expiringRows.length, 'ar')} عقدًا ضمن النطاق المحدد.`}
        eyebrow="قرارات تجديد"
        icon={AlertTriangle}
        action={exportAction}
        isLoading={isLoading}
      >
        {expiringRows.length === 0 ? (
          <div className="p-4">
            <ReportState message="لا توجد عقود نشطة تنتهي خلال الفترة القادمة." />
          </div>
        ) : (
          <ReportList>
            {expiringRows.map((row) => (
              <ReportListRow
                key={row.contractId}
                title={row.tenantName}
                subtitle={`${row.propertyTitle} · ${row.unitNumber ? `وحدة ${row.unitNumber}` : 'وحدة غير محددة'}`}
                meta={`ينتهي ${formatDate(row.endDate)}`}
                value={(
                  <div className="space-y-1 text-end">
                    <StatusBadge tone={urgencyTone(row.daysRemaining)}>
                      {formatLatinNumber(row.daysRemaining, 'ar')} يوم · {urgencyLabel(row.daysRemaining)}
                    </StatusBadge>
                    <p className="text-xs font-medium text-muted-foreground" dir="ltr">{formatMoney(row.monthlyRent)}</p>
                  </div>
                )}
                action={(
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => dialogNavigate({ to: '/contracts/$contractId', params: { contractId: row.contractId } })}
                  >
                    مراجعة التجديد
                  </Button>
                )}
              />
            ))}
          </ReportList>
        )}
      </ReportPanel>
    </div>
  );
}
