import type { ContractListItem } from '@/features/contracts/services/contractService';
import '@/lib/formatters';
import type { ReceiptRecord } from '@/features/financials/receipts/receiptService';
import {
  calculateDeferredRevenueSchedule,
  type DeferredRevenueSummary,
} from '@/features/financials/reports/deferred-revenue-service';

export type ReportHealthInsight = Readonly<{
  label: string;
  value: number;
  formattedValue: string;
  helper: string;
  tone: 'good' | 'warning' | 'critical' | 'neutral';
}>;

export type DeferredRevenueAudit = Readonly<{
  schedule: DeferredRevenueSummary;
  postedReceiptsCount: number;
  postedReceiptsAmount: number;
  linkedReceiptsCount: number;
  linkedReceiptsAmount: number;
  unlinkedReceiptsCount: number;
  unlinkedReceiptsAmount: number;
  candidateReceiptsCount: number;
  candidateContractsCount: number;
  invalidContractLinksCount: number;
  methodology: string;
}>;

function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

export function formatPercent(value: number) {
  return `${Math.round(value).toLatinLocaleString('ar')}%`;
}

export function getRatioTone(value: number, goodThreshold: number, warningThreshold: number): ReportHealthInsight['tone'] {
  if (value >= goodThreshold) return 'good';
  if (value >= warningThreshold) return 'warning';
  return 'critical';
}

export function buildExecutiveHealthInsights(params: Readonly<{
  invoiced: number;
  paid: number;
  outstanding: number;
  expenses: number;
  occupiedUnits: number;
  totalUnits: number;
}>): ReportHealthInsight[] {
  const collectionRate = safeRatio(params.paid, params.invoiced);
  const expenseRatio = safeRatio(params.expenses, params.paid);
  const occupancyRate = safeRatio(params.occupiedUnits, params.totalUnits);
  const receivablesRatio = safeRatio(params.outstanding, params.invoiced);

  return [
    {
      label: 'كفاءة التحصيل',
      value: collectionRate,
      formattedValue: formatPercent(collectionRate),
      helper: 'المحصّل مقارنة بإجمالي الفواتير',
      tone: getRatioTone(collectionRate, 85, 65),
    },
    {
      label: 'عبء المصروفات',
      value: expenseRatio,
      formattedValue: formatPercent(expenseRatio),
      helper: 'المصروفات مقارنة بالمتحصل',
      tone: expenseRatio <= 25 ? 'good' : expenseRatio <= 45 ? 'warning' : 'critical',
    },
    {
      label: 'إشغال المحفظة',
      value: occupancyRate,
      formattedValue: formatPercent(occupancyRate),
      helper: 'الوحدات المشغولة من إجمالي الوحدات',
      tone: getRatioTone(occupancyRate, 90, 75),
    },
    {
      label: 'انكشاف الذمم',
      value: receivablesRatio,
      formattedValue: formatPercent(receivablesRatio),
      helper: 'المستحق مقارنة بإجمالي الفواتير',
      tone: receivablesRatio <= 15 ? 'good' : receivablesRatio <= 35 ? 'warning' : 'critical',
    },
  ];
}

function isValidContractPeriod(contract: ContractListItem) {
  return Boolean(contract.start_date && contract.end_date && contract.start_date <= contract.end_date);
}

export function buildDeferredRevenueAudit(
  contracts: ContractListItem[],
  receipts: ReceiptRecord[],
  asOf: string,
): DeferredRevenueAudit {
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract] as const));
  const postedReceipts = receipts.filter((receipt) => receipt.status === 'posted' && receipt.payment_date <= asOf);
  const linkedReceipts = postedReceipts.filter((receipt) => Boolean(receipt.contract_id));
  const unlinkedReceipts = postedReceipts.filter((receipt) => !receipt.contract_id);
  const invalidContractLinks = linkedReceipts.filter((receipt) => !contractsById.has(receipt.contract_id!));
  const candidateReceipts = linkedReceipts.filter((receipt) => {
    const contract = receipt.contract_id ? contractsById.get(receipt.contract_id) : undefined;
    return Boolean(contract && isValidContractPeriod(contract) && receipt.payment_date <= contract.start_date);
  });

  const groupedCollections = new Map<string, {
    contractId: string;
    tenantName: string;
    propertyTitle: string;
    amount: number;
    startDate: string;
    endDate: string;
  }>();

  for (const receipt of candidateReceipts) {
    const contract = receipt.contract_id ? contractsById.get(receipt.contract_id) : undefined;
    if (!contract || !isValidContractPeriod(contract)) continue;
    const current = groupedCollections.get(contract.id) ?? {
      contractId: contract.id,
      tenantName: contract.people?.full_name || receipt.tenant_name || 'مستأجر غير محدد',
      propertyTitle: contract.properties?.title || receipt.property_title || 'عقار غير محدد',
      amount: 0,
      startDate: contract.start_date,
      endDate: contract.end_date,
    };
    current.amount += receipt.amount;
    groupedCollections.set(contract.id, current);
  }

  const schedule = calculateDeferredRevenueSchedule(Array.from(groupedCollections.values()), asOf);

  return {
    schedule,
    postedReceiptsCount: postedReceipts.length,
    postedReceiptsAmount: postedReceipts.reduce((total, receipt) => total + receipt.amount, 0),
    linkedReceiptsCount: linkedReceipts.length,
    linkedReceiptsAmount: linkedReceipts.reduce((total, receipt) => total + receipt.amount, 0),
    unlinkedReceiptsCount: unlinkedReceipts.length,
    unlinkedReceiptsAmount: unlinkedReceipts.reduce((total, receipt) => total + receipt.amount, 0),
    candidateReceiptsCount: candidateReceipts.length,
    candidateContractsCount: groupedCollections.size,
    invalidContractLinksCount: invalidContractLinks.length,
    methodology: 'يُعد التحصيل مقدمًا فقط عندما يكون الإيصال منشورًا، مرتبطًا بعقد فعلي، وتاريخ السداد في أو قبل تاريخ بداية العقد. ثم يوزّع المبلغ خطيًا على أشهر مدة العقد.',
  };
}
