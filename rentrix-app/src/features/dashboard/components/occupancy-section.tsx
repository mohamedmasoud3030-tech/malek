import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { Building2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportState,
} from '@/components/ui/report-section-primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
import {
  buildVacancyAgingBuckets,
  vacancyAgingBucketLabels,
  vacancyAgingBucketOrder,
} from '@/features/units/vacancy-analytics';
import { cn } from '@/lib/utils';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import {
  DistributionStrip,
  TrendDelta,
} from './dashboard-visuals';

/** Caller-owned interactivity for a canonical presentational row. */
const queueRowLinkClass =
  'block w-full min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25';

/** In-panel state strip: quiet, dashed, never a nested card. */
const inPanelStateClass =
  'min-h-0 rounded-none border-0 border-t border-dashed border-border/60 bg-muted/[0.08] py-3 sm:min-h-0';

interface OccupancySectionProps {
  snapshot: DashboardSnapshot | undefined;
  analytics: VacancyAnalytics;
  isLoading: boolean;
  isError?: boolean;
  /** Contract history can fail/truncate independently from the unit register. */
  detailsUnavailable?: boolean;
  settings: ReturnType<
    typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters
  >;
}

/**
 * Occupancy & vacancy. The occupancy KPI stays the server snapshot number;
 * the vacancy detail (days vacant, aging, longest vacancies) comes from the
 * shared vacancy derivation over the complete units/contracts read.
 * `available` remains the only vacancy authority — maintenance/reserved
 * units are never counted as vacant.
 */
const VACANCY_BAR_CLASSES: Record<string, string> = {
  days_0_15: 'bg-info',
  days_16_30: 'bg-warning/70',
  days_31_60: 'bg-warning',
};

function occupancyRateClass(rate: number): string {
  if (rate >= 90) return 'text-success';
  if (rate >= 75) return 'text-warning';
  return 'text-danger';
}

function changeDirection(points: number): 'up' | 'down' | 'neutral' {
  if (points > 0) return 'up';
  if (points < 0) return 'down';
  return 'neutral';
}

function changeTone(points: number): 'success' | 'danger' | 'neutral' {
  if (points > 0) return 'success';
  if (points < 0) return 'danger';
  return 'neutral';
}

function vacancyTone(daysVacant: number): 'danger' | 'warning' | 'info' {
  if (daysVacant >= 60) return 'danger';
  if (daysVacant >= 30) return 'warning';
  return 'info';
}

export const OccupancySection = memo(function OccupancySection({
  snapshot,
  analytics,
  isLoading,
  isError = false,
  detailsUnavailable = false,
  settings,
}: OccupancySectionProps) {
  const { money, date, number } = settings;
  const occupancyRate = snapshot?.occupancy.occupancyRate ?? 0;
  const occupiedUnits = snapshot?.occupancy.occupiedUnits ?? 0;
  const vacantUnits = snapshot?.occupancy.vacantUnits ?? 0;
  const snapshotUnavailable = !snapshot && !isLoading;
  const canTrustHistory = Boolean(snapshot) && !detailsUnavailable && !isError;
  const agingBuckets = buildVacancyAgingBuckets(analytics.vacantRows);
  const longestRows = analytics.vacantRows.slice(0, 3);
  const changePoints = Math.round(analytics.occupancyChangePoints);

  return (
    <ReportPanel
      dense
      tone={vacantUnits > 0 ? 'info' : 'success'}
      icon={Building2}
      title="الإشغال والشغور"
      titleId="occupancy-title"
      aria-labelledby="occupancy-title"
      description="حالة المحفظة الآن ومؤشر إعادة التأجير"
      action={
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="min-h-11 rounded-lg px-2 text-[11px] font-bold text-primary"
        >
          <Link
            to="/reports/$reportId"
            params={{ reportId: 'portfolio-property-performance' }}
            search={{ view: 'occupancy' }}
            data-dashboard-section-action
          >
            التقرير الكامل
          </Link>
        </Button>
      }
      className="h-full"
      isLoading={isLoading}
      loadingLabel="جارٍ تحميل الإشغال والشغور"
    >
      {snapshotUnavailable ? (
        <ReportState
          kind="error"
          title="تعذر تحميل مؤشر الإشغال المعتمد"
          message="تفاصيل الوحدات المحلية لا تُستخدم كبديل عن مؤشر لوحة التحكم المعتمد."
          className={inPanelStateClass}
        />
      ) : (
        <div
          className="grid min-w-0 gap-4 bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:p-4"
          data-dashboard-occupancy-summary
        >
          <div className="min-w-0 border-s-0 sm:border-e sm:border-border/70 sm:pe-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-muted-foreground">نسبة الإشغال</p>
                <p
                  className={cn(
                    'mt-0.5 text-3xl font-black tabular-nums leading-8',
                    occupancyRateClass(occupancyRate),
                  )}
                  dir="ltr"
                >
                  {occupancyRate}%
                </p>
              </div>
              <div className="min-w-0 text-end">
                <p className="text-[11px] font-bold text-muted-foreground">مشغولة / شاغرة</p>
                <p className="mt-0.5 text-base font-black tabular-nums leading-6 text-foreground" dir="ltr">
                  {isError ? '—' : number(occupiedUnits)} / {isError ? '—' : number(vacantUnits)}
                </p>
              </div>
            </div>
            {canTrustHistory && analytics.totalUnits > 0 ? (
              <TrendDelta
                className="mt-2.5"
                direction={changeDirection(changePoints)}
                tone={changeTone(changePoints)}
                text={`${Math.abs(changePoints)} نقطة عن نهاية الشهر السابق`}
              />
            ) : (
              <p className="mt-2.5 text-[11px] font-medium text-muted-foreground">
                {snapshot
                  ? `${number(snapshot.portfolio.units)} وحدة في المحفظة`
                  : 'بيانات المحفظة غير متاحة'}
              </p>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-muted-foreground">
                أعمار الشغور
              </p>
              {canTrustHistory && analytics.availableUnits > 0 ? (
                <span
                  className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground"
                  data-dashboard-average-vacancy
                >
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  متوسط {number(analytics.averageVacancyDays)} يوم
                </span>
              ) : null}
            </div>
            {isError || vacantUnits === 0 ? (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {isError
                  ? 'تفاصيل الشغور غير متاحة الآن.'
                  : 'لا توجد وحدات شاغرة حالياً.'}
              </p>
            ) : (
              <DistributionStrip
                className="mt-2"
                label="أعمار الوحدات الشاغرة"
                total={vacantUnits}
                segments={vacancyAgingBucketOrder
                  .map((key) => ({
                    key,
                    label: vacancyAgingBucketLabels[key],
                    count: agingBuckets[key],
                    barClass: VACANCY_BAR_CLASSES[key] ?? 'bg-danger',
                  }))
                  .filter((segment) => segment.count > 0)}
              />
            )}
          </div>
        </div>
      )}

      {!isLoading && !snapshotUnavailable && isError ? (
        <ReportState
          kind="error"
          title="تعذر تحميل سجل الوحدات الشاغرة"
          message="لن نحول رقم غير المشغولة القديم إلى شغور، لأن الصيانة والحجز ليستا وحدات متاحة للتأجير."
          className={inPanelStateClass}
        />
      ) : null}

      {!isLoading &&
      !snapshotUnavailable &&
      !isError &&
      detailsUnavailable &&
      vacantUnits > 0 ? (
        <ReportState
          kind="empty"
          title="تفاصيل مدة الشغور غير مكتملة"
          message="عدد الوحدات الشاغرة صحيح من سجل الوحدات، لكن متوسط الأيام متوقف حتى يكتمل تاريخ العقود."
          className={inPanelStateClass}
        />
      ) : null}

      {!isLoading &&
      !snapshotUnavailable &&
      !isError &&
      longestRows.length > 0 ? (
        <>
          <ReportList as="ul" label="أطول الوحدات الشاغرة">
            {longestRows.map((row) => {
              const tone = vacancyTone(row.daysVacant);
              return (
                <li key={row.unitId} className="min-w-0">
                  <Link
                    to="/properties"
                    search={{ section: 'units' }}
                    className={queueRowLinkClass}
                    data-dashboard-queue-link
                    aria-label={`وحدة ${row.unitNumber} — ${row.propertyTitle} — شاغرة منذ ${number(row.daysVacant)} يوم`}
                  >
                    <ReportListRow
                      dense
                      tone={tone}
                      title={`وحدة ${row.unitNumber}`}
                      subtitle={row.propertyTitle}
                      meta={
                        row.referenceRent !== null
                          ? `إيجار مرجعي: ${money(row.referenceRent)}`
                          : 'الإيجار المرجعي غير مسجل'
                      }
                      action={
                        <span className="flex flex-col items-end gap-1 text-[11px] font-semibold text-muted-foreground">
                          <StatusBadge tone={tone}>
                            {number(row.daysVacant)} يوم
                          </StatusBadge>
                          <span className="hidden sm:inline">
                            {row.lastContractEndDate
                              ? `آخر عقد ${date(row.lastContractEndDate)}`
                              : 'لم يسبق تأجيرها'}
                          </span>
                        </span>
                      }
                    />
                  </Link>
                </li>
              );
            })}
          </ReportList>

          {canTrustHistory ? (
            <div
              className="flex items-center gap-2 border-t border-border/70 px-3 py-2 text-[11px] font-bold text-muted-foreground sm:px-4"
              data-dashboard-longest-vacancy
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              الأطول: وحدة {longestRows[0].unitNumber} ·{' '}
              {number(longestRows[0].daysVacant)} يوم
              {analytics.vacancyRiskRows.length > 0
                ? ` · ${number(analytics.vacancyRiskRows.length)} عقد بلا خلف خلال ${60} يوماً`
                : ''}
            </div>
          ) : null}
        </>
      ) : null}
    </ReportPanel>
  );
});
