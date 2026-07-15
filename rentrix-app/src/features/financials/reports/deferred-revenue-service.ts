export type DeferredRevenueScheduleRow = {
  contractId: string;
  tenantName: string;
  propertyTitle: string;
  totalCollected: number;
  recognizedRevenueCurrentMonth: number;
  deferredRevenueRemaining: number;
  periodStart: string;
  periodEnd: string;
  monthlyAmortizationAmount: number;
};

export type DeferredRevenueSummary = {
  totalUpfrontCollections: number;
  totalRecognizedRevenue: number;
  totalDeferredLiability: number;
  schedules: DeferredRevenueScheduleRow[];
};

/**
 * Calculates monthly revenue recognition (Accrual Basis) for upfront collections.
 */
export function calculateDeferredRevenueSchedule(
  collections: Array<{
    contractId: string;
    tenantName: string;
    propertyTitle: string;
    amount: number;
    startDate: string;
    endDate: string;
  }>,
  asOfDateStr: string,
): DeferredRevenueSummary {
  const asOf = new Date(asOfDateStr);

  let totalUpfrontCollections = 0;
  let totalRecognizedRevenue = 0;
  let totalDeferredLiability = 0;

  const schedules: DeferredRevenueScheduleRow[] = collections.map((c) => {
    const start = new Date(c.startDate);
    const end = new Date(c.endDate);

    const totalMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
    const monthlyRate = c.amount / totalMonths;

    let elapsedMonths = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth()) + 1;
    elapsedMonths = Math.max(0, Math.min(totalMonths, elapsedMonths));

    const recognizedToDate = monthlyRate * elapsedMonths;
    const remainingDeferred = Math.max(0, c.amount - recognizedToDate);

    totalUpfrontCollections += c.amount;
    totalRecognizedRevenue += monthlyRate; // current month portion
    totalDeferredLiability += remainingDeferred;

    return {
      contractId: c.contractId,
      tenantName: c.tenantName,
      propertyTitle: c.propertyTitle,
      totalCollected: c.amount,
      recognizedRevenueCurrentMonth: Number(monthlyRate.toFixed(3)),
      deferredRevenueRemaining: Number(remainingDeferred.toFixed(3)),
      periodStart: c.startDate,
      periodEnd: c.endDate,
      monthlyAmortizationAmount: Number(monthlyRate.toFixed(3)),
    };
  });

  return {
    totalUpfrontCollections: Number(totalUpfrontCollections.toFixed(3)),
    totalRecognizedRevenue: Number(totalRecognizedRevenue.toFixed(3)),
    totalDeferredLiability: Number(totalDeferredLiability.toFixed(3)),
    schedules,
  };
}
