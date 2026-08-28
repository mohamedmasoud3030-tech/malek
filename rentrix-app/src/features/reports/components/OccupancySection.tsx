import { Building2, CalendarClock, DoorOpen, TrendingUp, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { formatDate, formatShortId } from '@/features/financials/components/financials-formatters';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { VACANCY_RISK_WINDOW_DAYS, type VacancyAnalytics } from '@/features/units/vacancy-analytics';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { buildExpiringContractsRows, buildOccupancyRows, getTodayLocalDateString } from '../reports-page.helpers';
import { SafeAnchor } from './common';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
} from './report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';
import { ReportShareActions } from './ReportShareActions';

export function OccupancySection({
  occupancyRows,
  vacancyAnalytics,
  historyComplete,
  canExportReports,
  isLoading,
}: Readonly<{
  occupancyRows: ReturnType<typeof buildOccupancyRows>;
  expiringRows: ReturnType<typeof buildExpiringContractsRows>;
  vacancyAnalytics: VacancyAnalytics;
  historyComplete: boolean;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const { money, number, date } = useCompanyFormatters();
  const totalUnits = vacancyAnalytics.totalUnits;
  const occupancyRate = vacancyAnalytics.occupancyRate;
  const vacancyRate = vacancyAnalytics.vacancyRate;
  const roundedOccupancyRate = Math.round(occupancyRate);
  const roundedVacancyRate = Math.round(vacancyRate);
  const longestVacant = vacancyAnalytics.vacantRows[0];
  const occupancyChange = vacancyAnalytics.occupancyChangePoints;
  const occupancyChangeLabel = `${occupancyChange >= 0 ? '+' : ''}${occupancyChange.toFixed(1)} نقطة`;

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();

  const buildOccupancyReportData = (): ReportDocumentData => {
    const todayStr = getTodayLocalDateString();
    return {
      reportTitle: 'تقرير الإشغال والشغور التشغيلي',
      reportType: 'Occupancy_Vacancy_Report',
      periodFrom: todayStr,
      periodTo: todayStr,
      sections: [
        {
          title: 'الإشغال حسب العقار',
          columns: ['العقار', 'إجمالي الوحدات', 'المشغولة', 'غير المشغولة', 'نسبة الإشغال'],
          rows: occupancyRows.map((row) => {
            const total = row.occupied + row.vacant;
            const rate = total > 0 ? Math.round((row.occupied / total) * 100) : 0;
            return [row.property, total, row.occupied, row.vacant, `${rate}%`];
          }),
          totals: ['الإجمالي العام', `${totalUnits}`, `${vacancyAnalytics.occupiedUnits}`, `${totalUnits - vacancyAnalytics.occupiedUnits}`, `${roundedOccupancyRate}%`],
        },
        {
          title: 'الوحدات الشاغرة حسب مدة الشغور',
          columns: ['الوحدة', 'العقار', 'الإيجار المرجعي', 'أيام الشغور', 'آخر عقد انتهى'],
          rows: vacancyAnalytics.vacantRows.map((row) => [
            row.unitNumber,
            row.propertyTitle,
            row.referenceRent ?? '—',
            row.daysVacant,
            row.lastContractEndDate ?? 'لم يسبق تأجيرها في السجل',
          ]),
        },
        {
          title: `عقود مرشحة للشغور خلال ${VACANCY_RISK_WINDOW_DAYS} يوم`,
          columns: ['المستأجر', 'العقار والوحدة', 'تاريخ الانتهاء', 'الأيام المتبقية'],
          rows: historyComplete ? vacancyAnalytics.vacancyRiskRows.map((row) => [
            row.tenantName,
            `${row.propertyTitle} · ${row.unitNumber}`,
            row.endDate,
            `${row.daysRemaining} يوم`,
          ]) : [],
        },
      ],
      totalSummary: [
        `الإشغال: ${roundedOccupancyRate}%`,
        `الشغور: ${roundedVacancyRate}%`,
        `متوسط الشغور: ${historyComplete ? `${vacancyAnalytics.averageVacancyDays} يوم` : 'غير متاح'}`,
        `القيمة المرجعية للشواغر: ${vacancyAnalytics.referenceVacantRent}`,
        `التغير عن الشهر السابق: ${historyComplete ? occupancyChangeLabel : 'غير متاح'}`,
      ].join(' | '),
    };
  };

  const handlePrintOccupancyReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.printDocument('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildOccupancyReportData()) }),
      fallbackMessage: 'تعذرت طباعة التقرير.',
    });
  };

  const handleDownloadOccupancyReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.downloadDocumentPdf('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildOccupancyReportData()) }),
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid data-report-summary="occupancy">
        <KpiCard
          label="نسبة الإشغال"
          value={`${roundedOccupancyRate}%`}
          icon={TrendingUp}
          sub={`${number(vacancyAnalytics.occupiedUnits)} من ${number(totalUnits)} وحدة`}
        />
        <KpiCard
          label="نسبة الشغور"
          value={`${roundedVacancyRate}%`}
          icon={DoorOpen}
          sub={`${number(vacancyAnalytics.availableUnits)} وحدة متاحة للتأجير`}
        />
        <KpiCard
          label="متوسط أيام الشغور"
          value={historyComplete ? `${number(vacancyAnalytics.averageVacancyDays)} يوم` : '—'}
          icon={CalendarClock}
          sub={historyComplete && longestVacant ? `الأطول ${number(longestVacant.daysVacant)} يوم` : 'يتطلب تاريخ عقود كامل'}
        />
        <KpiCard
          label="إيجار مرجعي للشواغر"
          value={money(vacancyAnalytics.referenceVacantRent)}
          icon={WalletCards}
          sub="سعر مرجعي وليس إيرادًا محققًا"
        />
      </ResponsiveCardGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportProgress
          label="إشغال المحفظة"
          value={occupancyRate}
          helper={`${number(vacancyAnalytics.occupiedUnits)} مشغولة من ${number(totalUnits)} وحدة`}
          tone={occupancyRate >= 90 ? 'good' : occupancyRate >= 75 ? 'warning' : 'critical'}
        />
        <ReportProgress
          label="الشغور الحقيقي"
          value={vacancyRate}
          helper={`${number(vacancyAnalytics.availableUnits)} متاحة · ${number(vacancyAnalytics.nonRentableUnits)} محجوزة/صيانة خارج الشغور`}
          tone={vacancyRate <= 5 ? 'good' : vacancyRate <= 15 ? 'warning' : 'critical'}
        />
      </div>

      <ReportInsightNote title="تغير الإشغال مقارنة بالشهر السابق">
        {!historyComplete
          ? 'تعذر اكتمال تاريخ العقود؛ لن نحسب تغيرًا تاريخيًا من بيانات ناقصة.'
          : `الإشغال الآن ${formatLatinNumber(roundedOccupancyRate, 'ar')}% مقابل ${formatLatinNumber(Math.round(vacancyAnalytics.previousMonthOccupancyRate), 'ar')}% في ${date(vacancyAnalytics.previousMonthEnd)}؛ التغير ${occupancyChangeLabel}.`}
      </ReportInsightNote>

      <ReportColumns>
        <ReportPanel
          title="الإشغال حسب العقار"
          description="المشغولة مقابل غير المشغولة لكل عقار. الصيانة والحجز لا يُعاد تصنيفهما كشغور حقيقي."
          eyebrow="استغلال المحفظة"
          icon={Building2}
          action={canExportReports ? (
            <ReportShareActions
              className="flex flex-wrap gap-2"
              reportLabel="تقرير الإشغال والشغور التشغيلي"
              target={{
                section: 'analytics',
                view: 'occupancy',
                filters: {
                  from: getTodayLocalDateString(),
                  to: getTodayLocalDateString(),
                  asOf: getTodayLocalDateString(),
                  propertyId: '',
                  unitId: '',
                  tenantId: '',
                  ownerId: '',
                  contractId: '',
                },
              }}
              summaryText={`الإشغال: ${roundedOccupancyRate}% | الشغور: ${roundedVacancyRate}% | متوسط الشغور: ${historyComplete ? vacancyAnalytics.averageVacancyDays : '—'} يوم`}
              onPrint={handlePrintOccupancyReport}
              onDownloadPdf={handleDownloadOccupancyReport}
            />
          ) : undefined}
          isLoading={isLoading}
        >
          {occupancyRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد وحدات متاحة لحساب الإشغال." /></div>
          ) : (
            <ReportList>
              {occupancyRows.map((row) => {
                const propertyTotal = row.occupied + row.vacant;
                const rate = propertyTotal > 0 ? Math.round((row.occupied / propertyTotal) * 100) : 0;
                return (
                  <ReportListRow
                    key={row.propertyId}
                    title={(
                      <span>
                        {row.property}
                        {!row.hasTitle ? <span className="ms-2 text-xs text-muted-foreground">اسم العقار غير موثق</span> : null}
                      </span>
                    )}
                    subtitle={`${formatCompanyNumber(defaultCompanyLocalSettings, row.occupied)} مشغولة · ${formatCompanyNumber(defaultCompanyLocalSettings, row.vacant)} غير مشغولة`}
                    meta={`${formatLatinNumber(propertyTotal, 'ar')} وحدة`}
                    value={<span dir="ltr">{rate}%</span>}
                  />
                );
              })}
            </ReportList>
          )}
        </ReportPanel>

        <ReportPanel
          title="أطول الوحدات شغورًا"
          description="الوحدات المتاحة مرتبة من الأطول شغورًا، مع آخر عقد والسعر المرجعي."
          eyebrow="مدة الشغور"
          icon={DoorOpen}
          isLoading={isLoading}
        >
          {!historyComplete ? (
            <div className="p-4"><ReportState message="تاريخ العقود غير مكتمل؛ تم إيقاف تحليل مدة الشغور حتى لا نعرض أيامًا مضللة." /></div>
          ) : vacancyAnalytics.vacantRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد وحدات شاغرة حاليًا." /></div>
          ) : (
            <ReportList>
              {vacancyAnalytics.vacantRows.slice(0, 12).map((row) => (
                <ReportListRow
                  key={row.unitId}
                  title={`وحدة ${row.unitNumber}`}
                  subtitle={`${row.propertyTitle} · ${row.lastContractEndDate ? `آخر عقد انتهى ${date(row.lastContractEndDate)}` : 'لم يسبق تأجيرها في السجل'}`}
                  meta={row.referenceRent !== null ? `مرجعي ${money(row.referenceRent)}` : 'السعر المرجعي غير مسجل'}
                  value={<StatusBadge tone={row.daysVacant >= 60 ? 'danger' : row.daysVacant >= 30 ? 'warning' : 'info'}>{number(row.daysVacant)} يوم</StatusBadge>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>

        <ReportPanel
          title={`مرشحة للشغور خلال ${VACANCY_RISK_WINDOW_DAYS} يوم`}
          description="عقود نشطة تنتهي قريبًا ولا يظهر لها تجديد أو عقد لاحق ملتزم في السجل."
          eyebrow="خطر شغور قادم"
          icon={CalendarClock}
          isLoading={isLoading}
        >
          {!historyComplete ? (
            <div className="p-4"><ReportState message="تاريخ العقود غير مكتمل؛ لن نصنف عقودًا كمرشحة للشغور من قراءة ناقصة." /></div>
          ) : vacancyAnalytics.vacancyRiskRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد عقود قريبة من الانتهاء بلا تجديد أو عقد لاحق ظاهر في السجل." /></div>
          ) : (
            <ReportList>
              {vacancyAnalytics.vacancyRiskRows.slice(0, 12).map((row) => (
                <ReportListRow
                  key={row.contractId}
                  title={row.tenantName}
                  subtitle={`${row.propertyTitle} · ${row.unitNumber} · ${formatDate(row.endDate)}`}
                  meta={<SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} />}
                  value={<StatusBadge tone={row.daysRemaining <= 15 ? 'danger' : 'warning'}>{number(row.daysRemaining)} يوم</StatusBadge>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>
      </ReportColumns>
    </div>
  );
}
