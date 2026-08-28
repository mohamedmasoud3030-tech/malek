import { Link } from '@tanstack/react-router';
import { Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { VacantUnitsSignal } from '../vacant-units-signal';

interface VacantUnitsSectionProps {
  signal: VacantUnitsSignal;
  /**
   * Server-authoritative vacant unit count (`occupancy.vacant_units`). The
   * queue rows are a bounded presentation slice, so the badge must not fall
   * back to rows.length when the server number is available.
   */
  serverVacantCount?: number;
  isLoading: boolean;
  isError?: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

/**
 * P3 — Today: vacant and out-of-service units.
 *
 * Answers "which units are not earning right now?" on Today itself: units
 * withdrawn for maintenance first (a problem), then vacant units (a re-letting
 * opportunity), then held reservations.
 */
export function VacantUnitsSection({ signal, serverVacantCount, isLoading, isError = false, settings }: VacantUnitsSectionProps) {
  const { money } = settings;
  const badgeCount = serverVacantCount ?? signal.availableCount;
  const problemCount = signal.outOfServiceCount;

  const meta = problemCount > 0
    ? `${problemCount} وحدة متوقفة للصيانة`
    : signal.reservedCount > 0
      ? `${signal.reservedCount} وحدة محجوزة بانتظار الإتمام`
      : 'فرص إعادة تأجير';

  return (
    <section className="dashboard-queue-card" aria-labelledby="vacant-units-title">
      <div className="dashboard-queue-card__header">
        <div className="dashboard-queue-card__title-group">
          <span
            className={cn('dashboard-queue-card__icon', problemCount > 0 ? 'dashboard-queue-card__icon--warning' : undefined)}
            aria-hidden="true"
          >
            <Building2 className="size-4" />
          </span>
          <div>
            <h3 id="vacant-units-title" className="dashboard-queue-card__title">وحدات بلا دخل</h3>
            <p className="dashboard-queue-card__meta">{meta}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && !isError ? (
            <StatusBadge tone={badgeCount > 0 || problemCount > 0 ? 'warning' : 'success'}>{badgeCount}</StatusBadge>
          ) : null}
          <Link to="/units" data-dashboard-section-action className="dashboard-section-link">عرض الكل</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="dashboard-queue-list" aria-label="جارٍ تحميل الوحدات بلا دخل">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : null}

      {!isLoading && isError ? (
        <div className="dashboard-queue-empty" role="alert">
          <p className="font-semibold">تعذر تحميل حالة الوحدات</p>
          <p>افتح صفحة الوحدات للتحقق. لن نعرض قائمة فارغة عند فشل التحميل.</p>
        </div>
      ) : null}

      {!isLoading && !isError && signal.rows.length === 0 ? (
        <div className="dashboard-queue-empty" role="status">
          <p className="font-semibold">كل الوحدات مؤجرة حالياً</p>
          <p>ستظهر هنا الوحدات الشاغرة أو المتوقفة عن التأجير.</p>
        </div>
      ) : null}

      {!isLoading && !isError && signal.rows.length > 0 ? (
        <ul className="dashboard-queue-list" role="list">
          {signal.rows.map((row) => {
            const isProblem = row.status === 'maintenance';
            return (
              <li key={row.unitId} role="listitem" className="min-w-0">
                <Link
                  to="/units"
                  className={cn('dashboard-queue-row', isProblem ? 'dashboard-queue-row--warning' : undefined)}
                  data-dashboard-queue-link
                  aria-label={`${row.title} — ${row.location} — ${row.statusLabel}`}
                >
                  <span className="dashboard-queue-row__main">
                    <span className="dashboard-queue-row__title">{row.title}</span>
                    <span className="dashboard-queue-row__meta">{row.location}</span>
                  </span>
                  <span className="dashboard-queue-row__side">
                    <StatusBadge tone={isProblem ? 'warning' : 'info'}>{row.statusLabel}</StatusBadge>
                    {row.referenceRent !== null ? (
                      <span className="dashboard-queue-row__date">إيجار مرجعي: {money(row.referenceRent)}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
