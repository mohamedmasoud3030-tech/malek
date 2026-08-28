/**
 * P3 — Today: utility obligations signal.
 *
 * Today must answer "what needs action now?" for operational obligations too,
 * not only contracts, collections and maintenance. Utilities are the P3-owned
 * operational obligation, so Today reads the same canonical utilities service
 * the Services workspace uses and applies the same shared derivation
 * (`utility-obligations`). There is no second utilities authority here.
 *
 * Counting discipline: `listUtilityBills` pages through every matching row and
 * fails closed on truncation (`fetchAllRows`), so the summary below is a
 * complete-set aggregate — not a capped browser prefix. When the read fails,
 * the caller must publish `undefined` and let Today say the signal is
 * unavailable instead of showing a reassuring fake zero.
 */
import type { UtilityBill } from '@/features/utilities/utilities-service';
import { responsiblePartyLabels } from '@/features/utilities/utilities-service';
import {
  compareUtilityObligationUrgency,
  deriveUtilityObligations,
  summarizeUtilityObligations,
  type UtilityObligationsSummary,
  type UtilityObligationUrgency,
} from '@/features/utilities/utility-obligations';

/** Bounded presentation rows for the Today queue card. Never a KPI source. */
export const UTILITY_QUEUE_ROW_LIMIT = 3;

export type UtilityObligationQueueRow = Readonly<{
  billId: string;
  title: string;
  meta: string;
  remainingAmount: number;
  urgency: Extract<UtilityObligationUrgency, 'overdue' | 'due_soon'>;
  daysOverdue: number;
  daysUntilDue: number;
}>;

export type UtilityObligationsSignal = Readonly<{
  summary: UtilityObligationsSummary;
  /** Overdue first, then due-soon; bounded for display. */
  rows: readonly UtilityObligationQueueRow[];
  /** Count Today puts in the action hierarchy: late plus imminently due. */
  actionableCount: number;
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
  rows: [],
  actionableCount: 0,
};

function queueRowMeta(urgency: 'overdue' | 'due_soon', daysOverdue: number, daysUntilDue: number, responsible: string) {
  if (urgency === 'overdue') return `متأخرة ${daysOverdue} يوم · ${responsible}`;
  if (daysUntilDue <= 0) return `تستحق اليوم · ${responsible}`;
  return `تستحق خلال ${daysUntilDue} يوم · ${responsible}`;
}

export function buildUtilityObligationsSignal(
  bills: readonly UtilityBill[] | undefined,
  today: string,
): UtilityObligationsSignal {
  if (!bills || bills.length === 0) return EMPTY_UTILITY_OBLIGATIONS_SIGNAL;

  const obligations = deriveUtilityObligations(bills, today).sort(compareUtilityObligationUrgency);
  const summary = summarizeUtilityObligations(obligations);

  const rows = obligations
    .filter((obligation): obligation is typeof obligation & { urgency: 'overdue' | 'due_soon' } =>
      obligation.urgency === 'overdue' || obligation.urgency === 'due_soon')
    .slice(0, UTILITY_QUEUE_ROW_LIMIT)
    .map((obligation) => ({
      billId: obligation.billId,
      title: obligation.billNumber ? `فاتورة ${obligation.billNumber}` : 'فاتورة مرافق بلا مرجع',
      meta: queueRowMeta(
        obligation.urgency,
        obligation.daysOverdue,
        obligation.daysUntilDue,
        responsiblePartyLabels[obligation.responsibleParty],
      ),
      remainingAmount: obligation.remainingAmount,
      urgency: obligation.urgency,
      daysOverdue: obligation.daysOverdue,
      daysUntilDue: obligation.daysUntilDue,
    }));

  return {
    summary,
    rows,
    actionableCount: summary.overdueCount + summary.dueSoonCount,
  };
}
