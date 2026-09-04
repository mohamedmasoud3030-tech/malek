/**
 * Today utility-obligations summary.
 *
 * Uses the shared complete-set utility derivation, but keeps only the aggregate
 * decision data the dashboard actually renders. Bill-level rows remain owned by
 * the Utilities workspace.
 */
import type { UtilityBill } from '@/features/utilities/utilities-service';
import {
  deriveUtilityObligations,
  summarizeUtilityObligations,
  type UtilityObligationsSummary,
} from '@/features/utilities/utility-obligations';

export type UtilityObligationsSignal = Readonly<{
  summary: UtilityObligationsSummary;
  /** Late plus imminently due obligations represented by the dashboard action. */
  actionableCount: number;
  /** Oldest late obligation, used only to rank the aggregate action. */
  oldestOverdueDays: number;
}>;

export const EMPTY_UTILITY_OBLIGATIONS_SIGNAL: UtilityObligationsSignal = {
  summary: {
    overdueCount: 0,
    overdueAmount: 0,
    dueSoonCount: 0,
    dueSoonAmount: 0,
    outstandingCount: 0,
    outstandingAmount: 0,
    remainingByResponsibleParty: { tenant: 0, landlord: 0, company: 0 },
  },
  actionableCount: 0,
  oldestOverdueDays: 0,
};

export function buildUtilityObligationsSignal(
  bills: readonly UtilityBill[] | undefined,
  today: string,
): UtilityObligationsSignal {
  if (!bills || bills.length === 0) return EMPTY_UTILITY_OBLIGATIONS_SIGNAL;

  const obligations = deriveUtilityObligations(bills, today);
  const summary = summarizeUtilityObligations(obligations);
  const oldestOverdueDays = obligations.reduce(
    (oldest, obligation) => obligation.urgency === 'overdue'
      ? Math.max(oldest, obligation.daysOverdue)
      : oldest,
    0,
  );

  return {
    summary,
    actionableCount: summary.overdueCount + summary.dueSoonCount,
    oldestOverdueDays,
  };
}
