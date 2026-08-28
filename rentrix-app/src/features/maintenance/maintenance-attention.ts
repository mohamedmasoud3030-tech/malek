/**
 * P3 — Maintenance operational attention.
 *
 * The canonical maintenance lifecycle is `report → in progress → work
 * completed → closed`, where "work completed" (`resolved`) means the technical
 * work is done and "closed" requires the operational/financial resolution.
 * The register previously showed only counts per status, so two real
 * operational problems were invisible:
 *
 * - requests that stopped moving (still open / in progress for too long);
 * - requests whose work is finished but that nobody closed.
 *
 * This module derives that attention state from fields the canonical
 * maintenance service already returns. It changes no lifecycle rule, performs
 * no write, and does not decide cost or responsibility — a human still
 * confirms closure.
 */
import { normalizeMaintenancePriority, normalizeMaintenanceStatus } from '@/lib/maintenanceStatus';
import type { Maintenance } from './maintenance-service';

/** A request still open past this age is treated as stalled. */
export const MAINTENANCE_STALLED_AFTER_DAYS = 7;

export type MaintenanceAttentionFlag = 'stalled' | 'awaiting_closure' | 'schedule_missed';

export type MaintenanceAttentionFilter = MaintenanceAttentionFlag | 'all';

export type MaintenanceAttention = Readonly<{
  requestId: string;
  /** Whole days since the request was reported; null when no date exists. */
  ageDays: number | null;
  /** Open or in progress for longer than the stalled window. */
  isStalled: boolean;
  /** Technical work reported done, operational closure still pending. */
  isAwaitingClosure: boolean;
  /** A scheduled visit date passed while the request is still unfinished. */
  hasMissedSchedule: boolean;
  isUrgent: boolean;
  flags: readonly MaintenanceAttentionFlag[];
}>;

export type MaintenanceAttentionSummary = Readonly<{
  stalled: number;
  awaitingClosure: number;
  scheduleMissed: number;
  /** Distinct requests carrying at least one attention flag. */
  needingAttention: number;
  /** Oldest still-unfinished request in days; 0 when nothing is open. */
  oldestOpenAgeDays: number;
}>;

export const maintenanceAttentionLabels: Record<MaintenanceAttentionFlag, string> = {
  stalled: 'متوقفة عن التقدم',
  awaiting_closure: 'بانتظار الإغلاق',
  schedule_missed: 'تجاوزت موعد الزيارة',
};

export const EMPTY_MAINTENANCE_ATTENTION_SUMMARY: MaintenanceAttentionSummary = {
  stalled: 0,
  awaitingClosure: 0,
  scheduleMissed: 0,
  needingAttention: 0,
  oldestOpenAgeDays: 0,
};

function toDayNumber(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(time) ? Math.floor(time / 86_400_000) : null;
}

/** Reported-on date: `request_date` is the business fact, `created_at` the fallback. */
function reportedDay(row: Maintenance): number | null {
  return toDayNumber(row.request_date) ?? toDayNumber(row.created_at);
}

export function deriveMaintenanceAttention(row: Maintenance, today: string): MaintenanceAttention {
  const status = normalizeMaintenanceStatus(row.status);
  const priority = normalizeMaintenancePriority(row.priority);
  const todayDay = toDayNumber(today);
  const startedDay = reportedDay(row);
  const ageDays = todayDay === null || startedDay === null ? null : Math.max(0, todayDay - startedDay);

  const isUnfinished = status === 'open' || status === 'in_progress';
  const isStalled = isUnfinished && ageDays !== null && ageDays > MAINTENANCE_STALLED_AFTER_DAYS;
  const isAwaitingClosure = status === 'resolved';

  const scheduledDay = toDayNumber(row.scheduled_date);
  const hasMissedSchedule = isUnfinished && scheduledDay !== null && todayDay !== null && scheduledDay < todayDay;

  const flags: MaintenanceAttentionFlag[] = [];
  if (isStalled) flags.push('stalled');
  if (isAwaitingClosure) flags.push('awaiting_closure');
  if (hasMissedSchedule) flags.push('schedule_missed');

  return {
    requestId: row.id,
    ageDays,
    isStalled,
    isAwaitingClosure,
    hasMissedSchedule,
    isUrgent: priority === 'urgent',
    flags,
  };
}

export function summarizeMaintenanceAttention(
  rows: readonly Maintenance[],
  today: string,
): MaintenanceAttentionSummary {
  let stalled = 0;
  let awaitingClosure = 0;
  let scheduleMissed = 0;
  let needingAttention = 0;
  let oldestOpenAgeDays = 0;

  for (const row of rows) {
    const attention = deriveMaintenanceAttention(row, today);
    if (attention.isStalled) stalled += 1;
    if (attention.isAwaitingClosure) awaitingClosure += 1;
    if (attention.hasMissedSchedule) scheduleMissed += 1;
    if (attention.flags.length > 0) needingAttention += 1;

    const status = normalizeMaintenanceStatus(row.status);
    if ((status === 'open' || status === 'in_progress') && attention.ageDays !== null) {
      oldestOpenAgeDays = Math.max(oldestOpenAgeDays, attention.ageDays);
    }
  }

  return { stalled, awaitingClosure, scheduleMissed, needingAttention, oldestOpenAgeDays };
}

export function matchesMaintenanceAttentionFilter(
  attention: MaintenanceAttention,
  filter: MaintenanceAttentionFilter,
): boolean {
  if (filter === 'all') return true;
  return attention.flags.includes(filter);
}
