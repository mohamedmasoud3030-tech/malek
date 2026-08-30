import { useMemo } from 'react';
import { AlertTriangle, FileText, TrendingDown } from 'lucide-react';
import { useDialogNavigate } from '@/app/router/background-location';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
import { buildReportCsvFilename, downloadCsv, type ExpiringContractRow } from '../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportState, ReportSummaryStrip } from './report-section-primitives';

type ExpiringContractsSectionProps = Readonly<{
  expiringRows: ExpiringContractRow[];
  vacancyAnalytics: VacancyAnalytics;
  canExportReports: boolean;
  isLoading: boolean;
}>;

/**
 * العقود القريبة من الانتهاء — deterministic leasing-risk view: days until
 * expiry, current contract value, vacancy duration and exposed income. No
 * renewal probability or predictive score is computed anywhere.
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
        })),
      )}
      disabled={expiringRows.length === 0}
    >
      <FileText className="size-4" aria-hidden="true" />
      CSV
    </Button>
  ) : undefined;

  return (
    <div className="space-y-4">
      <ReportPanel
        title="الدخل المعرض للخطر"
        description="إيجار العقود القريبة من الانتهاء وإيجار الوحدات الشاغرة — أرقام فعلية من العقود والوحدات، بلا توقعات."
        eyebrow="انكشاف تأجيري"
        icon={TrendingDown}
        isLoading={isLoading}
      >
        <div className="px-4 pt-3 sm:px-5">
          <ReportSummaryStrip
            dataReportSummary="expiring-income-risk"
            items={[
              { label: 'إيجار عقود قريبة من الانتهاء', value: formatMoney(exposedIncome.expiringRent), tone: 'warning' },
              { label: 'إيجار وحدات شاغرة', value: formatMoney(exposedIncome.vacantRent), tone: 'warning' },
              { label: 'الإجمالي المعرض', value: formatMoney(exposedIncome.total), tone: 'critical' },
            ]}
          />
        </div>
      </ReportPanel>

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
                meta={`ينتهي ${formatDate(row.endDate)} · ${formatLatinNumber(row.daysRemaining, 'ar')} يوم متبقٍ`}
                value={<span dir="ltr">{formatMoney(row.monthlyRent)}</span>}
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
