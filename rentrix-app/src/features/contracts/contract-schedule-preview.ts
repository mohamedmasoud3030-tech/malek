/**
 * Contract schedule preview helper.
 *
 * Canonical business meaning: `rent_amount` is the value of ONE contractual
 * payment for the selected payment cycle. It is therefore never divided by
 * the number of cycles in the contract. The server remains authoritative for
 * invoice issue/due dates (billing_day + grace_days); `sampleDates` below are
 * cycle-boundary previews only, not invoice due dates.
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

  function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const sampleDates: string[] = [];
  let current = new Date(start);
  let count = 0;

  // Walk cycle boundaries from contract start until end date. These dates are
  // deliberately not labelled as invoice issue/due dates: the authoritative
  // billing engine resolves those from billing_day/grace_days.
  while (current <= end && count < 120) {
    sampleDates.push(formatLocalDate(current));
    count += 1;
    current = new Date(current.getFullYear(), current.getMonth() + stepMonths, current.getDate());
  }

  return {
    installmentCount: count,
    amountPerInstallment: rentAmount,
    sampleDates,
  };
}
