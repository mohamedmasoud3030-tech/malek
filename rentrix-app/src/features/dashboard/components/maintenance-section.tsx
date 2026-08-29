import { Link } from '@tanstack/react-router';
import { AlertTriangle, Wrench } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { DashboardQueueMaintenanceRow } from '../dashboard-snapshot';
import type { MaintenanceDashboardSummary } from '../maintenance-dashboard-summary';
import type { MaintenanceFollowUpSignal } from '../maintenance-follow-up-signal';
import { TrendDelta } from './dashboard-visuals';
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

/** Highest-value cases shown on the command center; the register keeps the rest. */
export const MAINTENANCE_TOP_CASES_LIMIT = 4;

interface MaintenanceSectionProps {
  summary: MaintenanceDashboardSummary;
  urgentRows: readonly DashboardQueueMaintenanceRow[];
  followUp: MaintenanceFollowUpSignal;
  isLoading: boolean;
  isError?: boolean;
  /** The complete maintenance read behind the follow-up signal. */
  maintenanceIsLoading: boolean;
  maintenanceIsError: boolean;
}

function maintenanceLocation(row: DashboardQueueMaintenanceRow) {
  return [row.propertyTitle, row.unitNumber ? `الوحدة ${row.unitNumber}` : null].filter(Boolean).join(' · ') || 'الموقع غير محدد';
}

/**
 * Maintenance on the command center: a concise operational summary plus ONLY
 * the highest-value cases (urgent requests and work that stopped moving).
 * The dashboard is not the maintenance register — the footer deep-links to it.
 */
export function MaintenanceSection({
  summary,
  urgentRows,
  followUp,
  isLoading,
  isError = false,
  maintenanceIsLoading,
  maintenanceIsError,
}: MaintenanceSectionProps) {
  const urgentCount = summary.urgentOpen ?? 0;
  const resolutionTrend = summary.resolutionChangePercent;

  return (
    <DashboardSignalPanel labelledBy="maintenance-title" className="h-full">
      <DashboardSignalHeader
        id="maintenance-title"
        title="الصيانة"
        meta={
          urgentCount > 0
            ? `${urgentCount} طلب عاجل يحتاج تدخلاً`
            : summary.active > 0
              ? `${summary.active} طلب نشط قيد المتابعة`
              : 'لا توجد طلبات نشطة'
        }
        icon={Wrench}
        tone={urgentCount > 0 ? 'danger' : summary.active > 0 ? 'info' : 'success'}
        trailing={(
          <>
            {!isLoading && !isError ? (
              <StatusBadge tone={urgentCount > 0 ? 'danger' : 'success'}>{summary.active}</StatusBadge>
            ) : null}
            <Link to="/maintenance" data-dashboard-section-action className={dashboardSectionActionClass}>عرض الكل</Link>
          </>
        )}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل الصيانة" /> : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/70 bg-muted/20 p-3 md:grid-cols-4 md:p-4" data-dashboard-maintenance-summary>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground">الطلبات</p>
            <p className="mt-0.5 text-xl font-black tabular-nums text-foreground">{summary.total}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground">مكتملة</p>
            <p className="mt-0.5 text-xl font-black tabular-nums text-success">{summary.completed}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground">نشطة</p>
            <p className="mt-0.5 text-xl font-black tabular-nums text-foreground">{summary.active}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground">عاجلة</p>
            <p className={`mt-0.5 text-xl font-black tabular-nums ${urgentCount > 0 ? 'text-danger' : 'text-foreground'}`}>{urgentCount}</p>
          </div>
          {summary.averageResolutionDays !== null ? (
            <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5 sm:col-span-4" data-dashboard-maintenance-resolution>
              <p className="text-[11px] font-bold text-muted-foreground">متوسط زمن الإنجاز (آخر 90 يوماً)</p>
              <span className="flex items-center gap-2">
                <span className="text-sm font-black tabular-nums text-foreground">{summary.averageResolutionDays} يوم</span>
                {resolutionTrend !== null ? (
                  <TrendDelta
                    direction={resolutionTrend > 0 ? 'up' : resolutionTrend < 0 ? 'down' : 'neutral'}
                    tone={resolutionTrend > 0 ? 'danger' : resolutionTrend < 0 ? 'success' : 'neutral'}
                    text={`${Math.abs(resolutionTrend)}%`}
                  />
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {!isLoading && isError ? (
        <DashboardSignalEmpty role="alert" title="تعذر تحميل الصيانة العاجلة" description="راجع تنبيه أعلى الصفحة ثم أعد المحاولة." />
      ) : null}

      {!isLoading && !isError && maintenanceIsLoading ? (
        <DashboardSignalLoading label="جارٍ تحميل متابعة الصيانة" />
      ) : null}

      {!isLoading && !isError && !maintenanceIsLoading && maintenanceIsError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل متابعة الصيانة"
          description="افتح سجل الصيانة للتحقق. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}

      {!isLoading && !isError && !maintenanceIsLoading && !maintenanceIsError && urgentRows.length === 0 && followUp.actionableCount === 0 ? (
        <DashboardSignalEmpty title="لا توجد صيانة عاجلة الآن" description="الطلبات الجديدة والمتوقفة ستظهر هنا عندما تحتاج متابعة." />
      ) : null}

      {!isLoading && !isError && (urgentRows.length > 0 || (!maintenanceIsLoading && !maintenanceIsError && followUp.rows.length > 0)) ? (
        <DashboardSignalList label="أهم حالات الصيانة">
          {urgentRows.slice(0, 2).map((row) => (
            <li key={row.id} role="listitem" className="min-w-0">
              <Link
                to="/maintenance"
                className={dashboardSignalRowClass('danger')}
                data-dashboard-queue-link
                aria-label={`${row.title || 'طلب صيانة عاجل'} — ${maintenanceLocation(row)}`}
              >
                <DashboardSignalMain title={row.title || 'طلب صيانة عاجل'} meta={maintenanceLocation(row)} />
                <DashboardSignalSide>
                  <StatusBadge tone="danger">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    عاجل
                  </StatusBadge>
                </DashboardSignalSide>
              </Link>
            </li>
          ))}

          {!maintenanceIsLoading && !maintenanceIsError
            ? followUp.rows.slice(0, Math.max(0, MAINTENANCE_TOP_CASES_LIMIT - Math.min(urgentRows.length, 2))).map((row) => (
              <li key={row.requestId} role="listitem" className="min-w-0">
                <Link
                  to="/maintenance"
                  className={dashboardSignalRowClass('warning')}
                  data-dashboard-queue-link
                  aria-label={`${row.title} — ${row.location} — ${row.flagLabel}`}
                >
                  <DashboardSignalMain title={row.title} meta={`${row.location} · ${row.flagLabel}`} />
                  <DashboardSignalSide>
                    {row.ageDays !== null ? <StatusBadge tone="warning">{row.ageDays} يوم</StatusBadge> : null}
                  </DashboardSignalSide>
                </Link>
              </li>
            ))
            : null}
        </DashboardSignalList>
      ) : null}
    </DashboardSignalPanel>
  );
}
