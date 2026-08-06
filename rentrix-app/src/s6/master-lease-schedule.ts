export type LeasePayment = Readonly<{
  period: number;
  amountMinor: number;
}>;

export type LeaseScheduleInput = Readonly<{
  payments: readonly LeasePayment[];
  annualDiscountRateBps: number;
  periodsPerYear: number;
  initialDirectCostsMinor?: number;
  incentivesMinor?: number;
  prepaymentsMinor?: number;
}>;

export type LeaseScheduleRow = Readonly<{
  period: number;
  openingLiabilityMinor: number;
  interestMinor: number;
  paymentMinor: number;
  principalMinor: number;
  closingLiabilityMinor: number;
  rouDepreciationMinor: number;
  closingRouAssetMinor: number;
}>;

export type LeaseSchedule = Readonly<{
  initialLiabilityMinor: number;
  initialRouAssetMinor: number;
  periodicRate: number;
  rows: readonly LeaseScheduleRow[];
}>;

function assertIntegerMinor(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer in minor units`);
  }
}

function roundMinor(value: number): number {
  return Math.round(value);
}

export function buildMasterLeaseSchedule(input: LeaseScheduleInput): LeaseSchedule {
  if (!Number.isFinite(input.annualDiscountRateBps) || input.annualDiscountRateBps < 0) {
    throw new Error('annualDiscountRateBps must be a non-negative finite number');
  }
  if (!Number.isInteger(input.periodsPerYear) || input.periodsPerYear <= 0) {
    throw new Error('periodsPerYear must be a positive integer');
  }
  if (input.payments.length === 0) {
    throw new Error('payments must contain at least one period');
  }

  const sortedPayments = [...input.payments].sort((a, b) => a.period - b.period);
  const seen = new Set<number>();
  for (const payment of sortedPayments) {
    if (!Number.isInteger(payment.period) || payment.period <= 0) {
      throw new Error('payment period must be a positive integer');
    }
    if (seen.has(payment.period)) {
      throw new Error(`duplicate payment period: ${payment.period}`);
    }
    seen.add(payment.period);
    assertIntegerMinor(payment.amountMinor, 'payment amount');
  }

  const directCosts = input.initialDirectCostsMinor ?? 0;
  const incentives = input.incentivesMinor ?? 0;
  const prepayments = input.prepaymentsMinor ?? 0;
  assertIntegerMinor(directCosts, 'initialDirectCostsMinor');
  assertIntegerMinor(incentives, 'incentivesMinor');
  assertIntegerMinor(prepayments, 'prepaymentsMinor');

  const periodicRate = input.annualDiscountRateBps / 10_000 / input.periodsPerYear;
  const initialLiabilityMinor = roundMinor(
    sortedPayments.reduce(
      (total, payment) => total + payment.amountMinor / Math.pow(1 + periodicRate, payment.period),
      0,
    ),
  );

  const initialRouAssetMinor = initialLiabilityMinor + directCosts + prepayments - incentives;
  if (initialRouAssetMinor < 0) {
    throw new Error('initial ROU asset cannot be negative');
  }

  const maxPeriod = sortedPayments[sortedPayments.length - 1]!.period;
  const paymentByPeriod = new Map(sortedPayments.map((payment) => [payment.period, payment.amountMinor]));
  const straightLineDepreciationMinor = initialRouAssetMinor / maxPeriod;

  let liability = initialLiabilityMinor;
  let rouAsset = initialRouAssetMinor;
  const rows: LeaseScheduleRow[] = [];

  for (let period = 1; period <= maxPeriod; period += 1) {
    const openingLiabilityMinor = liability;
    const interestMinor = roundMinor(openingLiabilityMinor * periodicRate);
    let paymentMinor = paymentByPeriod.get(period) ?? 0;

    // The final payment is a settlement payment. Derive it from the remaining
    // liability plus final-period interest so the roll-forward remains exact
    // in integer minor units without force-zeroing the closing balance.
    if (period === maxPeriod) {
      paymentMinor = openingLiabilityMinor + interestMinor;
    }

    const principalMinor = paymentMinor - interestMinor;
    const closingLiabilityMinor = openingLiabilityMinor + interestMinor - paymentMinor;

    if (closingLiabilityMinor < 0) {
      throw new Error(`payment in period ${period} over-settles the lease liability`);
    }

    const rouDepreciationMinor =
      period === maxPeriod ? rouAsset : roundMinor(straightLineDepreciationMinor);
    const closingRouAssetMinor = Math.max(0, rouAsset - rouDepreciationMinor);

    rows.push({
      period,
      openingLiabilityMinor,
      interestMinor,
      paymentMinor,
      principalMinor,
      closingLiabilityMinor,
      rouDepreciationMinor,
      closingRouAssetMinor,
    });

    liability = closingLiabilityMinor;
    rouAsset = closingRouAssetMinor;
  }

  return {
    initialLiabilityMinor,
    initialRouAssetMinor,
    periodicRate,
    rows,
  };
}
