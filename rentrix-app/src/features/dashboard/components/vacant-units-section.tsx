import { Link } from '@tanstack/react-router';
import { Building2, CalendarClock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';

interface VacantUnitsSectionProps {
  analytics: VacancyAnalytics;
  isLoading: boolean;
  isError?: boolean;
  /** Contract history can fail/truncate independently from the unit register. */
  detailsUnavailable?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

/**
 * Dashboard vacancy signal: two headline facts only, then bounded detail.
 *
 * `available` in the canonical unit register is the vacancy authority. The
 * dashboard snapshot historically groups every non-occupied unit together, so
 * using its `vacantUnits` field would incorrectly count maintenance/reserved as
 * true vacancy. Deeper portfolio ratios and trend analysis live in Reports.
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
  const rows = analytics.vacantRows.slice(0, 5);

  return (
    <section className="dashboard-queue-card" aria-labelledby="vacant-units-title" data-dashboard-vacancy-card>
      <div className="dashboard-queue-card__header">
        <div className="dashboard-queue-card__title-group">
          <span className="dashboard-queue-card__icon" aria-hidden="true">
            <Building2 className="size-4" />
          </span>
          <div>
            <h3 id="vacant-units-title" className="dashboard-queue-card__title">الوحدات الشاغرة</h3>
            <p className="dashboard-queue-card__meta">إشارة سريعة لإعادة التأجير، والتحليل الكامل في التقارير.</p>
          </div>
        </div>
        <Link to="/reports" data-dashboard-section-action className="dashboard-section-link">التقرير الكامل</Link>
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-label="جارٍ تحميل مؤشر الشغور">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-end sm:justify-between" data-dashboard-vacancy-summary>
            <div>
              <p className="text-xs font-bold text-muted-foreground">الشاغر الآن</p>
              <p className="mt-1 text-2xl font-black tracking-tight">
                {isError ? '—' : number(vacantCount)} <span className="text-sm font-bold text-muted-foreground">وحدة شاغرة</span>
              </p>
            </div>
            <div className="sm:text-end">
              <p className="text-xs font-bold text-muted-foreground">متوسط الشغور</p>
              <p className="mt-1 text-lg font-black" data-dashboard-average-vacancy>
                {!isError && canTrustHistory ? `${number(analytics.averageVacancyDays)} يوم` : '—'}
              </p>
            </div>
          </div>

          {isError ? (
            <div className="dashboard-queue-empty" role="alert">
              <p className="font-semibold">تعذر تحميل سجل الوحدات الشاغرة</p>
              <p>لن نحول رقم «غير المشغولة» القديم إلى شغور، لأن الصيانة والحجز ليسا وحدات متاحة للتأجير.</p>
            </div>
          ) : null}

          {!isError && detailsUnavailable && vacantCount > 0 ? (
            <div className="dashboard-queue-empty" role="status">
              <p className="font-semibold">تفاصيل مدة الشغور غير مكتملة</p>
              <p>تعذر قراءة تاريخ العقود كاملًا؛ عدد الوحدات الشاغرة صحيح من سجل الوحدات، لكن متوسط الأيام متوقف حتى تكتمل البيانات.</p>
            </div>
          ) : null}

          {!isError && vacantCount === 0 ? (
            <div className="dashboard-queue-empty" role="status">
              <p className="font-semibold">لا توجد وحدات شاغرة حاليًا</p>
              <p>الوحدات المحجوزة أو المتوقفة للصيانة لا تُحسب كشاغرة.</p>
            </div>
          ) : null}

          {!isError && rows.length > 0 ? (
            <ul className="dashboard-queue-list" role="list" aria-label="تفاصيل الوحدات الشاغرة">
              {rows.map((row) => (
                <li key={row.unitId} role="listitem" className="min-w-0">
                  <Link
                    to="/units"
                    className="dashboard-queue-row"
                    data-dashboard-queue-link
                    aria-label={`وحدة ${row.unitNumber} — ${row.propertyTitle} — شاغرة منذ ${number(row.daysVacant)} يوم`}
                  >
                    <span className="dashboard-queue-row__main">
                      <span className="dashboard-queue-row__title">وحدة {row.unitNumber}</span>
                      <span className="dashboard-queue-row__meta">{row.propertyTitle}</span>
                      <span className="dashboard-queue-row__date">
                        {row.referenceRent !== null ? `إيجار مرجعي: ${money(row.referenceRent)}` : 'الإيجار المرجعي غير مسجل'}
                      </span>
                    </span>
                    <span className="dashboard-queue-row__side">
                      <StatusBadge tone={row.daysVacant >= 60 ? 'danger' : row.daysVacant >= 30 ? 'warning' : 'info'}>
                        {number(row.daysVacant)} يوم
                      </StatusBadge>
                      <span className="dashboard-queue-row__date">
                        {row.lastContractEndDate ? `آخر عقد انتهى ${date(row.lastContractEndDate)}` : 'لم يسبق تأجيرها في السجل'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {!isError && rows.length > 0 && canTrustHistory ? (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-muted-foreground" data-dashboard-longest-vacancy>
              <CalendarClock className="size-4" aria-hidden="true" />
              الأطول شغورًا: وحدة {rows[0].unitNumber} · {number(rows[0].daysVacant)} يوم
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
