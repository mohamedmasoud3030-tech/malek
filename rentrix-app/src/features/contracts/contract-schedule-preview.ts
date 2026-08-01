/**
 * Canonical contract invoice schedule calculation helper.
 * Computes estimated installment counts and dates based on lease start/end dates
 * and payment cycle without hardcoded duration assumptions.
 */
export type PaymentCycle = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | string;

export interface ContractSchedulePreviewResult {
  installmentCount: number;
  amountPerInstallment: number;
  sampleDates: string[];
}

export function calculateContractSchedulePreview(
  startDateStr: string | undefined | null,
  endDateStr: string | undefined | null,
  paymentCycle: PaymentCycle | string | undefined | null,
  rentAmount: number,
): ContractSchedulePreviewResult {
  if (!startDateStr || !endDateStr || !rentAmount || rentAmount <= 0) {
    return { installmentCount: 0, amountPerInstallment: 0, sampleDates: [] };
  }

  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { installmentCount: 0, amountPerInstallment: 0, sampleDates: [] };
  }

  const cycle = paymentCycle || 'monthly';
  const stepMonths =
    cycle === 'quarterly' ? 3 :
    cycle === 'semi_annual' ? 6 :
    cycle === 'annual' ? 12 : 1;

  const sampleDates: string[] = [];
  let current = new Date(start);
  let count = 0;

  // Walk from start until end date is reached
  while (current <= end && count < 120) {
    sampleDates.push(current.toISOString().slice(0, 10));
    count += 1;
    current = new Date(current.getFullYear(), current.getMonth() + stepMonths, current.getDate());
  }

  return {
    installmentCount: count,
    amountPerInstallment: count > 0 ? Number((rentAmount / count).toFixed(3)) : rentAmount,
    sampleDates,
  };
}
