import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { Building2, CalendarClock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
import {
  buildVacancyAgingBuckets,
  vacancyAgingBucketLabels,
  vacancyAgingBucketOrder,
} from '@/features/units/vacancy-analytics';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import { DistributionStrip, RadialMetric, TrendDelta } from './dashboard-visuals';
import {
  DashboardSignalEmpty,
  DashboardSignalHeader,
  DashboardSignalList,
  DashboardSignalLoading,
  DashboardSignalMain,
  DashboardSignalPanel,
  DashboardSignalSide,
  dashboardSectionActionClass,
  dashboardSignalRowClass,
} from './dashboard-signal-primitives';

interface OccupancySectionProps {
  snapshot: DashboardSnapshot | undefined;
  analytics: VacancyAnalytics;
  isLoading: boolean;
  isError?: boolean;
  /** Contract history can fail/truncate independently from the unit register. */
  detailsUnavailable?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

/**
 * Occupancy & vacancy. The occupancy KPI stays the server snapshot number;
 * the vacancy detail (days vacant, aging, longest vacancies) comes from the
 * shared vacancy derivation over the complete units/contracts read.
 * `available` remains the only vacancy authority — maintenance/reserved
 * units are never counted as vacant.
 */
export const OccupancySection = memo(function OccupancySection({
  snapshot,
  analytics,
  isLoading,
  isError = false,
  detailsUnavailable = false,
  settings,
}: OccupancySectionProps) {
  const { money, date, number } = settings;
  const occupancyRate = snapshot?.occupancy.occupancyRate ?? analytics.occupancyRate;
  const occupiedUnits = snapshot?.occupancy.occupiedUnits ?? analytics.occupiedUnits;
  const vacantUnits = snapshot?.occupancy.vacantUnits ?? analytics.availableUnits;
  const canTrustHistory = !detailsUnavailable && !isError;
  const agingBuckets = buildVacancyAgingBuckets(analytics.vacantRows);
  const longestRows = analytics.vacantRows.slice(0, 3);
  const changePoints = Math.round(analytics.occupancyChangePoints);

  return (
    <DashboardSignalPanel labelledBy="occupancy-title" className="h-full">
      <DashboardSignalHeader
        id="occupancy-title"
        title="الإشغال والشغور"
        meta="حالة المحفظة الآن ومؤشر إعادة التأجير"
        icon={Building2}
        tone={vacantUnits > 0 ? 'info' : 'success'}
        trailing={<Link to="/reports" data-dashboard-section-action className={dashboardSectionActionClass}>التقرير الكامل</Link>}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل الإشغال والشغور" /> : (
        <div className="grid min-w-0 gap-4 border-t border-border/70 bg-muted/20 p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-4" data-dashboard-occupancy-summary>
          <div className="flex items-center gap-3">
            <RadialMetric
              percent={occupancyRate}
              label={`نسبة الإشغال ${occupancyRate}%`}
              size={92}
              fillClass={occupancyRate >= 90 ? 'text-success' : occupancyRate >= 75 ? 'text-warning' : 'text-danger'}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground">مشغولة / شاغرة</p>
              <p className="mt-0.5 text-xl font-black tabular-nums leading-7 text-foreground" dir="ltr">
                {isError ? '—' : number(occupiedUnits)} / {isError ? '—' : number(vacantUnits)}
              </p>
              {canTrustHistory && analytics.totalUnits > 0 ? (
                <TrendDelta
                  className="mt-1"
                  direction={changePoints > 0 ? 'up' : changePoints < 0 ? 'down' : 'neutral'}
                  tone={changePoints > 0 ? 'success' : changePoints < 0 ? 'danger' : 'neutral'}
                  text={`${Math.abs(changePoints)} نقطة عن نهاية الشهر السابق`}
                />
              ) : (
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {analytics.totalUnits > 0 ? `${number(analytics.totalUnits)} وحدة في المحفظة` : 'لا توجد وحدات مسجلة'}
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 border-s-0 sm:border-s sm:border-border/70 sm:ps-4">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-muted-foreground">أعمار الشغور</p>
              {canTrustHistory && analytics.availableUnits > 0 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground" data-dashboard-average-vacancy>
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  متوسط {number(analytics.averageVacancyDays)} يوم
                </span>
              ) : null}
            </div>
            {isError || vacantUnits === 0 ? (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {isError ? 'تفاصيل الشغور غير متاحة الآن.' : 'لا توجد وحدات شاغرة حالياً.'}
              </p>
            ) : (
              <DistributionStrip
                className="mt-2"
                label="أعمار الوحدات الشاغرة"
                total={vacantUnits}
                segments={vacancyAgingBucketOrder.map((key) => ({
                  key,
                  label: vacancyAgingBucketLabels[key],
                  count: agingBuckets[key],
                  barClass: key === 'days_0_15' ? 'bg-info' : key === 'days_16_30' ? 'bg-warning/70' : key === 'days_31_60' ? 'bg-warning' : 'bg-danger',
                }))}
              />
            )}
          </div>
        </div>
      )}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل سجل الوحدات الشاغرة"
          description="لن نحول رقم غير المشغولة القديم إلى شغور، لأن الصيانة والحجز ليسا وحدات متاحة للتأجير."
        />
      ) : null}

      {!isLoading && !isError && detailsUnavailable && vacantUnits > 0 ? (
        <DashboardSignalEmpty
          title="تفاصيل مدة الشغور غير مكتملة"
          description="عدد الوحدات الشاغرة صحيح من سجل الوحدات، لكن متوسط الأيام متوقف حتى يكتمل تاريخ العقود."
        />
      ) : null}

      {!isLoading && !isError && longestRows.length > 0 ? (
        <>
          <DashboardSignalList label="أطول الوحدات الشاغرة">
            {longestRows.map((row) => {
              const tone = row.daysVacant >= 60 ? 'danger' : row.daysVacant >= 30 ? 'warning' : 'info';
              return (
                <li key={row.unitId} role="listitem" className="min-w-0">
                  <Link
                    to="/units"
                    className={dashboardSignalRowClass(tone)}
                    data-dashboard-queue-link
                    aria-label={`وحدة ${row.unitNumber} — ${row.propertyTitle} — شاغرة منذ ${number(row.daysVacant)} يوم`}
                  >
                    <DashboardSignalMain
                      title={`وحدة ${row.unitNumber}`}
                      meta={row.propertyTitle}
                      detail={row.referenceRent !== null ? `إيجار مرجعي: ${money(row.referenceRent)}` : 'الإيجار المرجعي غير مسجل'}
                    />
                    <DashboardSignalSide>
                      <StatusBadge tone={tone}>{number(row.daysVacant)} يوم</StatusBadge>
                      <span className="hidden sm:inline">
                        {row.lastContractEndDate ? `آخر عقد ${date(row.lastContractEndDate)}` : 'لم يسبق تأجيرها'}
                      </span>
                    </DashboardSignalSide>
                  </Link>
                </li>
              );
            })}
          </DashboardSignalList>

          {canTrustHistory ? (
            <div className="flex items-center gap-2 border-t border-border/70 px-3 py-2 text-[11px] font-bold text-muted-foreground sm:px-4" data-dashboard-longest-vacancy>
              <CalendarClock className="size-3.5" aria-hidden="true" />
              الأطول: وحدة {longestRows[0].unitNumber} · {number(longestRows[0].daysVacant)} يوم
              {analytics.vacancyRiskRows.length > 0 ? ` · ${number(analytics.vacancyRiskRows.length)} عقد بلا خلف خلال ${60} يوماً` : ''}
            </div>
          ) : null}
        </>
      ) : null}
    </DashboardSignalPanel>
  );
});
