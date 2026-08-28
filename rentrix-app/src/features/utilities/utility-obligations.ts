/**
 * P3 — Utilities operational obligations.
 *
 * MALEK tracks the utility *obligation* (amount due, paid, remaining,
 * responsible party, evidence) rather than acting as a utility-billing
 * platform. This module is the single pure derivation for the operational
 * reading of a utility bill: how much is still owed, whether it is already
 * late, and whether it becomes due inside the near operating window.
 *
 * It derives nothing financial that another authority owns: `amount` and
 * `paid_amount` stay exactly as the canonical utilities service returned them.
 * Remaining is presentation arithmetic on those two persisted values, not a
 * competing ledger.
 */
import type { ResponsibleParty, UtilityBill } from './utilities-service';

/** Near window used by the operational surfaces to mean "due very soon". */
export const UTILITY_DUE_SOON_WINDOW_DAYS = 7;

export type UtilityObligationUrgency = 'overdue' | 'due_soon' | 'scheduled' | 'settled';

export type UtilityObligation = Readonly<{
  billId: string;
  billNumber: string | null;
  propertyId: string;
  unitId: string | null;
  meterId: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  responsibleParty: ResponsibleParty;
  urgency: UtilityObligationUrgency;
  /** Positive only when the obligation is late; otherwise 0. */
  daysOverdue: number;
  /** Positive while the obligation is still ahead; negative once late. */
  daysUntilDue: number;
}>;

export type UtilityObligationsSummary = Readonly<{
  overdueCount: number;
  overdueAmount: number;
  dueSoonCount: number;
  dueSoonAmount: number;
  /** Every still-unsettled obligation, regardless of urgency. */
  outstandingCount: number;
  outstandingAmount: number;
  /** Unsettled remaining split by who actually owes it operationally. */
  remainingByResponsibleParty: Readonly<Record<ResponsibleParty, number>>;
}>;

export const utilityObligationUrgencyLabels: Record<UtilityObligationUrgency, string> = {
  overdue: 'متأخرة',
  due_soon: 'تستحق قريباً',
  scheduled: 'ضمن الجدول',
  settled: 'مسددة',
};

export const utilityObligationUrgencyTone: Record<UtilityObligationUrgency, 'danger' | 'warning' | 'info' | 'success'> = {
  overdue: 'danger',
  due_soon: 'warning',
  scheduled: 'info',
  settled: 'success',
};

function toDayNumber(value: string): number | null {
  // Utility due dates are calendar dates (YYYY-MM-DD). Comparing them as UTC
  // midnights keeps "late by N days" stable regardless of the viewer timezone.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(time) ? Math.floor(time / 86_400_000) : null;
}

function roundMoney(value: number): number {
  // OMR is a three-decimal currency; keep derived remainders on the same grid
  // so a fully paid bill never leaves a floating-point crumb behind.
  return Math.round(value * 1000) / 1000;
}

/** Remaining obligation for one bill, never negative even when overpaid. */
export function utilityBillRemaining(bill: Pick<UtilityBill, 'amount' | 'paid_amount'>): number {
  const remaining = roundMoney((Number(bill.amount) || 0) - (Number(bill.paid_amount) || 0));
  return remaining > 0 ? remaining : 0;
}

export function deriveUtilityObligation(bill: UtilityBill, today: string): UtilityObligation {
  const remainingAmount = utilityBillRemaining(bill);
  const dueDay = toDayNumber(bill.due_date);
  const todayDay = toDayNumber(today);
  const daysUntilDue = dueDay === null || todayDay === null ? 0 : dueDay - todayDay;

  let urgency: UtilityObligationUrgency = 'scheduled';
  if (bill.status === 'paid' || remainingAmount <= 0) {
    urgency = 'settled';
  } else if (daysUntilDue < 0) {
    urgency = 'overdue';
  } else if (daysUntilDue <= UTILITY_DUE_SOON_WINDOW_DAYS) {
    urgency = 'due_soon';
  }

  return {
    billId: bill.id,
    billNumber: bill.bill_number ?? null,
    propertyId: bill.property_id,
    unitId: bill.unit_id ?? null,
    meterId: bill.meter_id ?? null,
    dueDate: bill.due_date,
    amount: Number(bill.amount) || 0,
    paidAmount: Number(bill.paid_amount) || 0,
    remainingAmount,
    responsibleParty: bill.responsible_party,
    urgency,
    daysOverdue: urgency === 'overdue' ? Math.abs(daysUntilDue) : 0,
    daysUntilDue,
  };
}

export function deriveUtilityObligations(bills: readonly UtilityBill[], today: string): UtilityObligation[] {
  return bills.map((bill) => deriveUtilityObligation(bill, today));
}

/**
 * Rank obligations the way an operator triages them: latest first, then the
 * nearest upcoming due date, then the larger remaining amount.
 */
export function compareUtilityObligationUrgency(a: UtilityObligation, b: UtilityObligation): number {
  const order: Record<UtilityObligationUrgency, number> = { overdue: 0, due_soon: 1, scheduled: 2, settled: 3 };
  if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
  if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
  return b.remainingAmount - a.remainingAmount;
}

export function summarizeUtilityObligations(
  obligations: readonly UtilityObligation[],
): UtilityObligationsSummary {
  const remainingByResponsibleParty: Record<ResponsibleParty, number> = { tenant: 0, landlord: 0, company: 0 };
  let overdueCount = 0;
  let overdueAmount = 0;
  let dueSoonCount = 0;
  let dueSoonAmount = 0;
  let outstandingCount = 0;
  let outstandingAmount = 0;

  for (const obligation of obligations) {
    if (obligation.urgency === 'settled') continue;
    outstandingCount += 1;
    outstandingAmount += obligation.remainingAmount;
    remainingByResponsibleParty[obligation.responsibleParty] += obligation.remainingAmount;
    if (obligation.urgency === 'overdue') {
      overdueCount += 1;
      overdueAmount += obligation.remainingAmount;
    } else if (obligation.urgency === 'due_soon') {
      dueSoonCount += 1;
      dueSoonAmount += obligation.remainingAmount;
    }
  }

  return {
    overdueCount,
    overdueAmount: roundMoney(overdueAmount),
    dueSoonCount,
    dueSoonAmount: roundMoney(dueSoonAmount),
    outstandingCount,
    outstandingAmount: roundMoney(outstandingAmount),
    remainingByResponsibleParty: {
      tenant: roundMoney(remainingByResponsibleParty.tenant),
      landlord: roundMoney(remainingByResponsibleParty.landlord),
      company: roundMoney(remainingByResponsibleParty.company),
    },
  };
}
