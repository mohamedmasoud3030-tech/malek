/**
 * Canonical billing schedule — single authoritative algorithm.
 * Must match server's generate_invoices_from_active_contracts period logic.
 * This is the ONE source of truth for billing period, issue_date, due_date.
 * Any client helper must be proven bit-for-bit equivalent via PGlite tests.
 */

export type PaymentCycle = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | string;

export function getBillingPeriodForCycle(paymentCycle: string, refDate: Date): { start: Date; end: Date } {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  switch (paymentCycle) {
    case 'monthly':
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0),
      };
    case 'quarterly': {
      const quarter = Math.floor(month / 3);
      const qStartMonth = quarter * 3;
      return {
        start: new Date(year, qStartMonth, 1),
        end: new Date(year, qStartMonth + 3, 0),
      };
    }
    case 'semi_annual': {
      if (month <= 5) {
        return { start: new Date(year, 0, 1), end: new Date(year, 5, 30) };
      } else {
        return { start: new Date(year, 6, 1), end: new Date(year, 11, 31) };
      }
    }
    case 'annual':
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
    default:
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
  }
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getIssueDate(periodStart: Date, periodEnd: Date, billingDay: number): Date {
  const issue = new Date(periodStart);
  issue.setDate(Math.min(billingDay, periodEnd.getDate()));
  return issue;
}

export function getDueDate(periodEnd: Date, graceDays: number): Date {
  const due = new Date(periodEnd);
  due.setDate(due.getDate() + graceDays);
  return due;
}

export type BillingStatus = 'NOT_DUE' | 'DUE' | 'GENERATED' | 'BLOCKED' | 'CHECK_FAILED';

export type BillingStatusInput = {
  periodStart: Date;
  issueDate: Date;
  today: Date;
  invoiceExists: boolean;
  blockedReason: string | null;
  taxCheckFailed?: boolean;
};

export function deriveBillingStatus(input: BillingStatusInput): { status: BillingStatus; blockedReason: string | null } {
  const { issueDate, today, invoiceExists, blockedReason, taxCheckFailed } = input;

  if (taxCheckFailed) {
    return { status: 'CHECK_FAILED', blockedReason: blockedReason ?? 'TAX_CHECK_FAILED: تعذر التحقق من السلطة الضريبية' };
  }

  if (blockedReason) {
    return { status: 'BLOCKED', blockedReason };
  }

  if (invoiceExists) {
    return { status: 'GENERATED', blockedReason: null };
  }

  // Truthful NOT_DUE logic: before billing day → NOT_DUE, on/after → DUE if absent
  // This matches authoritative schedule: issue_date is when invoice becomes due for generation
  if (today < issueDate) {
    return { status: 'NOT_DUE', blockedReason: null };
  }

  return { status: 'DUE', blockedReason: null };
}

// Helper for contract-level blocked reasons
export function getContractBlockedReason(contract: {
  agreement_id?: string | null;
  collection_role_snapshot?: string | null;
  operating_model_snapshot?: string | null;
}): string | null {
  if (!contract.agreement_id) {
    return 'AGREEMENT_MISSING: لا توجد اتفاقية إدارة مرتبطة';
  }
  if (!contract.collection_role_snapshot || !contract.operating_model_snapshot) {
    return 'MODEL_SNAPSHOT_MISSING: العقد ليس OWNER_AGENCY مُجمد بالكامل';
  }
  return null;
}
