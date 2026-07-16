export type DeferredRevenueScheduleRow = {
  contractId: string;
  tenantName: string;
  propertyTitle: string;
  totalCollected: number;
  recognizedRevenueCurrentMonth: number;
  recognizedRevenueToDate: number;
  deferredRevenueRemaining: number;
  periodStart: string;
  periodEnd: string;
  monthlyAmortizationAmount: number;
  totalMonths: number;
  elapsedMonths: number;
};

export type DeferredRevenueSummary = {
  totalUpfrontCollections: number;
  totalRecognizedRevenueCurrentMonth: number;
  totalRecognizedRevenueToDate: number;
  totalDeferredLiability: number;
  schedules: DeferredRevenueScheduleRow[];
};

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function monthDistanceInclusive(start: Date, end: Date) {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
}

function roundMoney(value: number) {
  return Number(value.toFixed(3));
}

/**
 * Calculates straight-line monthly revenue recognition for collections that
 * have already been verified as upfront payments linked to a real contract.
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
  const asOf = parseDateOnly(asOfDateStr);

  let totalUpfrontCollections = 0;
  let totalRecognizedRevenueCurrentMonth = 0;
  let totalRecognizedRevenueToDate = 0;
  let totalDeferredLiability = 0;

  const schedules: DeferredRevenueScheduleRow[] = [];

  for (const collection of collections) {
    const start = parseDateOnly(collection.startDate);
    const end = parseDateOnly(collection.endDate);
    if (!asOf || !start || !end || start > end || collection.amount <= 0) continue;

    const totalMonths = Math.max(1, monthDistanceInclusive(start, end));
    const monthlyRate = collection.amount / totalMonths;
    const isCurrentMonthRecognizable = asOf >= start && asOf <= end;
    const elapsedMonths = asOf < start
      ? 0
      : Math.max(0, Math.min(totalMonths, monthDistanceInclusive(start, asOf)));
    const recognizedToDate = Math.min(collection.amount, monthlyRate * elapsedMonths);
    const currentMonthRecognition = isCurrentMonthRecognizable ? monthlyRate : 0;
    const remainingDeferred = Math.max(0, collection.amount - recognizedToDate);

    totalUpfrontCollections += collection.amount;
    totalRecognizedRevenueCurrentMonth += currentMonthRecognition;
    totalRecognizedRevenueToDate += recognizedToDate;
    totalDeferredLiability += remainingDeferred;

    schedules.push({
      contractId: collection.contractId,
      tenantName: collection.tenantName,
      propertyTitle: collection.propertyTitle,
      totalCollected: roundMoney(collection.amount),
      recognizedRevenueCurrentMonth: roundMoney(currentMonthRecognition),
      recognizedRevenueToDate: roundMoney(recognizedToDate),
      deferredRevenueRemaining: roundMoney(remainingDeferred),
      periodStart: collection.startDate,
      periodEnd: collection.endDate,
      monthlyAmortizationAmount: roundMoney(monthlyRate),
      totalMonths,
      elapsedMonths,
    });
  }

  schedules.sort((a, b) => b.deferredRevenueRemaining - a.deferredRevenueRemaining || a.contractId.localeCompare(b.contractId));

  return {
    totalUpfrontCollections: roundMoney(totalUpfrontCollections),
    totalRecognizedRevenueCurrentMonth: roundMoney(totalRecognizedRevenueCurrentMonth),
    totalRecognizedRevenueToDate: roundMoney(totalRecognizedRevenueToDate),
    totalDeferredLiability: roundMoney(totalDeferredLiability),
    schedules,
  };
}
