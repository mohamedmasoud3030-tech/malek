/**
 * Command center — maintenance operational summary.
 *
 * The dashboard already reads the COMPLETE maintenance register for the
 * follow-up signal (`listMaintenance` pages through every row and fails
 * closed on truncation), so these summary numbers are complete-set
 * aggregates of the same read — no extra query, no capped prefix.
 *
 * Urgent-open pressure stays server-authoritative: the page passes the
 * snapshot's `maintenance.urgentOpen` through untouched when present.
 *
 * Resolution time is a transparent average over requests that carry both a
 * reported-on date and a completion date. It is an operational display
 * metric, not an accounting number.
 */
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import { normalizeMaintenancePriority, normalizeMaintenanceStatus } from '@/lib/maintenanceStatus';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Resolution trend compares two trailing windows of this length. */
export const MAINTENANCE_RESOLUTION_WINDOW_DAYS = 90;

export type MaintenanceDashboardSummary = Readonly<{
  total: number;
  /** open + in_progress. */
  active: number;
  /** resolved + closed. */
  completed: number;
  /** Urgent open/in-progress — server-authoritative when supplied. */
  urgentOpen: number | null;
  /** Average days to complete within the trailing window; null when no completions. */
  averageResolutionDays: number | null;
  /** Average for the window before that; null when not comparable. */
  previousAverageResolutionDays: number | null;
  /** Signed percentage change vs previous window; null unless both windows have data. */
  resolutionChangePercent: number | null;
}>;

export const EMPTY_MAINTENANCE_DASHBOARD_SUMMARY: MaintenanceDashboardSummary = {
  total: 0,
  active: 0,
  completed: 0,
  urgentOpen: null,
  averageResolutionDays: null,
  previousAverageResolutionDays: null,
  resolutionChangePercent: null,
};

function toDayNumber(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(time) ? Math.floor(time / DAY_MS) : null;
}

function reportedDay(row: Maintenance): number | null {
  return toDayNumber(row.request_date) ?? toDayNumber(row.created_at);
}

function completedDay(row: Maintenance): number | null {
  return toDayNumber(row.completed_at) ?? toDayNumber(row.resolved_at);
}

function isActiveStatus(status: string): boolean {
  return status === 'open' || status === 'in_progress';
}

function isCompletedStatus(status: string): boolean {
  return status === 'resolved' || status === 'closed';
}

/**
 * Builds the maintenance summary for the command center.
 * `serverUrgentOpen` is the snapshot KPI; it is passed through as-is and is
 * never recomputed from rows when the snapshot is available.
 */
export function buildMaintenanceDashboardSummary(
  requests: readonly Maintenance[] | undefined,
  today: string,
  serverUrgentOpen?: number,
  windowDays = MAINTENANCE_RESOLUTION_WINDOW_DAYS,
): MaintenanceDashboardSummary {
  const rows = requests ?? [];
  if (rows.length === 0) {
    return { ...EMPTY_MAINTENANCE_DASHBOARD_SUMMARY, urgentOpen: serverUrgentOpen ?? null };
  }

  const todayDay = toDayNumber(today);
  let active = 0;
  let completed = 0;
  let urgentOpenFallback = 0;

  const currentResolutions: number[] = [];
  const previousResolutions: number[] = [];

  for (const row of rows) {
    const status = normalizeMaintenanceStatus(row.status);
    const priority = normalizeMaintenancePriority(row.priority);

    if (isActiveStatus(status)) {
      active += 1;
      if (priority === 'urgent') urgentOpenFallback += 1;
    }
    if (isCompletedStatus(status)) completed += 1;

    const done = completedDay(row);
    const started = reportedDay(row);
    if (done === null || started === null || todayDay === null) continue;
    const age = done - started;
    if (age < 0) continue;

    const daysSinceDone = todayDay - done;
    if (daysSinceDone < 0 || daysSinceDone > windowDays * 2) continue;
    if (daysSinceDone <= windowDays) currentResolutions.push(age);
    else previousResolutions.push(age);
  }

  const average = (values: number[]) =>
    values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;

  const averageResolutionDays = average(currentResolutions);
  const previousAverageResolutionDays = average(previousResolutions);

  let resolutionChangePercent: number | null = null;
  if (averageResolutionDays !== null && previousAverageResolutionDays !== null && previousAverageResolutionDays > 0) {
    resolutionChangePercent = Math.round(
      ((averageResolutionDays - previousAverageResolutionDays) / previousAverageResolutionDays) * 100,
    );
  }

  return {
    total: rows.length,
    active,
    completed,
    urgentOpen: serverUrgentOpen ?? urgentOpenFallback,
    averageResolutionDays,
    previousAverageResolutionDays,
    resolutionChangePercent,
  };
}
