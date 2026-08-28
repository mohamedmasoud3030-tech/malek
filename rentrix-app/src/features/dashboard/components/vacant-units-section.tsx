import { Link } from '@tanstack/react-router';
import { Building2, CalendarClock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
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

interface VacantUnitsSectionProps {
  analytics: VacancyAnalytics;
  isLoading: boolean;
  isError?: boolean;
  /** Contract history can fail/truncate independently from the unit register. */
  detailsUnavailable?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

/**
 * Dashboard vacancy signal. `available` in the canonical unit register is the
 * vacancy authority; maintenance/reserved are deliberately not treated as
 * rentable vacancy.
 */
export function VacantUnitsSection({
  analytics,
  isLoading,
  isError = false,
  detailsUnavailable = false,
  settings,
}: VacantUnitsSectionProps) {
  const { money, date, number } = settings;
  const vacantCount = analytics.availableUnits;
  const canTrustHistory = !detailsUnavailable;
  const rows = analytics.vacantRows.slice(0, 3);

  return (
    <DashboardSignalPanel labelledBy="vacant-units-title" className="h-full" >
      <DashboardSignalHeader
        id="vacant-units-title"
        title="الوحدات الشاغرة"
        meta="مؤشر إعادة التأجير"
        icon={Building2}
        tone={vacantCount > 0 ? 'info' : 'success'}
        trailing={<Link to="/reports" data-dashboard-section-action className={dashboardSectionActionClass}>التقرير الكامل</Link>}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل مؤشر الشغور" /> : (
        <div
          className="grid grid-cols-2 gap-3 border-t border-border/70 bg-muted/20 px-3 py-2.5 sm:px-4"
          data-dashboard-vacancy-summary
        >
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground">الشاغر الآن</p>
            <p className="mt-0.5 truncate text-xl font-black tracking-tight text-foreground">
              {isError ? '—' : number(vacantCount)} <span className="text-xs font-bold text-muted-foreground">وحدة</span>
            </p>
          </div>
          <div className="min-w-0 border-s border-border/70 ps-3">
            <p className="text-[11px] font-bold text-muted-foreground">متوسط الشغور</p>
            <p className="mt-0.5 truncate text-xl font-black tracking-tight text-foreground" data-dashboard-average-vacancy>
              {!isError && canTrustHistory ? `${number(analytics.averageVacancyDays)} يوم` : '—'}
            </p>
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

      {!isLoading && !isError && detailsUnavailable && vacantCount > 0 ? (
        <DashboardSignalEmpty
          title="تفاصيل مدة الشغور غير مكتملة"
          description="عدد الوحدات الشاغرة صحيح من سجل الوحدات، لكن متوسط الأيام متوقف حتى يكتمل تاريخ العقود."
        />
      ) : null}

      {!isLoading && !isError && vacantCount === 0 ? (
        <DashboardSignalEmpty title="لا توجد وحدات شاغرة حاليًا" description="المحجوزة أو المتوقفة للصيانة لا تُحسب كشاغرة." />
      ) : null}

      {!isLoading && !isError && rows.length > 0 ? (
        <DashboardSignalList label="تفاصيل الوحدات الشاغرة">
          {rows.map((row) => {
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
      ) : null}

      {!isLoading && !isError && rows.length > 0 && canTrustHistory ? (
        <div className="flex items-center gap-2 border-t border-border/70 px-3 py-2 text-[11px] font-bold text-muted-foreground sm:px-4" data-dashboard-longest-vacancy>
          <CalendarClock className="size-3.5" aria-hidden="true" />
          الأطول: وحدة {rows[0].unitNumber} · {number(rows[0].daysVacant)} يوم
        </div>
      ) : null}
    </DashboardSignalPanel>
  );
}
