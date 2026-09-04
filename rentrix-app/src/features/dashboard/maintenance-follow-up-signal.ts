/**
 * Today maintenance follow-up summary.
 *
 * Reuses the canonical Services attention derivation. The dashboard needs only
 * aggregate decision counts and the oldest open age; detailed maintenance rows
 * belong to the maintenance workspace and are not rebuilt here.
 */
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import { summarizeMaintenanceAttention } from '@/features/maintenance/maintenance-attention';

export type MaintenanceFollowUpSignal = Readonly<{
  /** Unfinished work that has not moved inside the stalled window. */
  stalledCount: number;
  /** Work reported as done that nobody has closed. */
  awaitingClosureCount: number;
  /** Unfinished work whose scheduled visit date has passed. */
  scheduleMissedCount: number;
  /** Distinct requests behind the counts above. */
  actionableCount: number;
  /** Age of the oldest unfinished request, null when nothing is unfinished. */
  oldestOpenAgeDays: number | null;
}>;

export const EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL: MaintenanceFollowUpSignal = {
  stalledCount: 0,
  awaitingClosureCount: 0,
  scheduleMissedCount: 0,
  actionableCount: 0,
  oldestOpenAgeDays: null,
};

export function buildMaintenanceFollowUpSignal(
  requests: readonly Maintenance[] | undefined,
  today: string,
): MaintenanceFollowUpSignal {
  if (!requests || requests.length === 0) return EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL;

  const summary = summarizeMaintenanceAttention(requests, today);
  return {
    stalledCount: summary.stalled,
    awaitingClosureCount: summary.awaitingClosure,
    scheduleMissedCount: summary.scheduleMissed,
    actionableCount: summary.needingAttention,
    oldestOpenAgeDays: summary.oldestOpenAgeDays,
  };
}
