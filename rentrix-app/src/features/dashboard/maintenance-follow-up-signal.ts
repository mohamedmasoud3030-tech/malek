/**
 * P3 — Today: maintenance follow-up signal.
 *
 * Today already showed *urgent* maintenance, which answers "what was reported
 * as an emergency?" It never answered the question an office owner actually
 * loses money on: "what did we start and then stop?" and "what is finished but
 * still open on our books?" Those requests are rarely marked urgent — they age
 * quietly inside the Services register.
 *
 * Authority discipline:
 * - the derivation is the Services one (`features/maintenance/maintenance-attention`),
 *   so Today and the maintenance register can never disagree;
 * - `listMaintenance` pages through every matching row and fails closed on
 *   truncation, so the counts are complete-set aggregates;
 * - no lifecycle transition, cost or responsibility is decided here, and
 *   nothing is written.
 */
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import {
  deriveMaintenanceAttention,
  maintenanceAttentionLabels,
  summarizeMaintenanceAttention,
  type MaintenanceAttentionFlag,
} from '@/features/maintenance/maintenance-attention';

/** Bounded presentation rows for the Today queue card. Never a KPI source. */
export const MAINTENANCE_FOLLOW_UP_ROW_LIMIT = 3;

export type MaintenanceFollowUpRow = Readonly<{
  requestId: string;
  title: string;
  location: string;
  flag: MaintenanceAttentionFlag;
  flagLabel: string;
  ageDays: number | null;
}>;

export type MaintenanceFollowUpSignal = Readonly<{
  /** Unfinished work that has not moved inside the stalled window. */
  stalledCount: number;
  /** Work reported as done that nobody has closed. */
  awaitingClosureCount: number;
  /** Unfinished work whose scheduled visit date has passed. */
  scheduleMissedCount: number;
  /** Distinct requests behind the counts above — the queue badge. */
  actionableCount: number;
  /** Age of the oldest unfinished request, `null` when nothing is unfinished. */
  oldestOpenAgeDays: number | null;
  rows: readonly MaintenanceFollowUpRow[];
}>;

export const EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL: MaintenanceFollowUpSignal = {
  stalledCount: 0,
  awaitingClosureCount: 0,
  scheduleMissedCount: 0,
  actionableCount: 0,
  oldestOpenAgeDays: null,
  rows: [],
};

/**
 * Work the office has already paid attention to but not finished ranks above a
 * completed request waiting for paperwork.
 */
const flagRank: Record<MaintenanceAttentionFlag, number> = {
  stalled: 0,
  schedule_missed: 1,
  awaiting_closure: 2,
};

export function buildMaintenanceFollowUpSignal(
  requests: readonly Maintenance[] | undefined,
  today: string,
  propertyTitles?: ReadonlyMap<string, string>,
  unitNumbers?: ReadonlyMap<string, string>,
  rowLimit = MAINTENANCE_FOLLOW_UP_ROW_LIMIT,
): MaintenanceFollowUpSignal {
  if (!requests || requests.length === 0) return EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL;

  const summary = summarizeMaintenanceAttention(requests, today);
  if (summary.needingAttention === 0) {
    return { ...EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL, oldestOpenAgeDays: summary.oldestOpenAgeDays };
  }

  const rows: MaintenanceFollowUpRow[] = [];
  for (const request of requests) {
    const attention = deriveMaintenanceAttention(request, today);
    const flag = attention.flags[0];
    if (!flag) continue;
    rows.push({
      requestId: request.id,
      title: request.title?.trim() || 'طلب صيانة بلا عنوان',
      location: buildLocation(request, propertyTitles, unitNumbers),
      flag,
      flagLabel: maintenanceAttentionLabels[flag],
      ageDays: attention.ageDays,
    });
  }

  rows.sort((a, b) => {
    if (flagRank[a.flag] !== flagRank[b.flag]) return flagRank[a.flag] - flagRank[b.flag];
    // Oldest first inside a flag: it has been waiting longest.
    return (b.ageDays ?? -1) - (a.ageDays ?? -1);
  });

  return {
    stalledCount: summary.stalled,
    awaitingClosureCount: summary.awaitingClosure,
    scheduleMissedCount: summary.scheduleMissed,
    actionableCount: summary.needingAttention,
    oldestOpenAgeDays: summary.oldestOpenAgeDays,
    rows: rows.slice(0, Math.max(0, rowLimit)),
  };
}

/**
 * Location in operator language. Names are used only when the canonical reads
 * supplied them — an unresolved id is never printed at the owner.
 */
function buildLocation(
  request: Maintenance,
  propertyTitles?: ReadonlyMap<string, string>,
  unitNumbers?: ReadonlyMap<string, string>,
): string {
  const property = request.property_id ? propertyTitles?.get(request.property_id) : undefined;
  const unit = request.unit_id ? unitNumbers?.get(request.unit_id) : undefined;
  const parts = [property ?? 'عقار غير محدد', unit ? `الوحدة ${unit}` : null].filter(Boolean);
  return parts.join(' · ');
}
