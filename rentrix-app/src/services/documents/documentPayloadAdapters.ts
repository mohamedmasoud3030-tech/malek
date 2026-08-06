import { deriveHonestReference } from './companyIdentity';
import type {
  BalanceSheetDocumentData,
  ContractDocumentData,
  IncomeStatementDocumentData,
  InvoiceDocumentData,
  OwnerStatementData,
  ReportDocumentData,
  ReceiptDocumentData,
  TenantStatementData,
  TrialBalanceDocumentData,
} from './documentCompatibilityTypes';

export type {
  BalanceSheetDocumentData,
  ContractDocumentData,
  IncomeStatementDocumentData,
  InvoiceDocumentData,
  OwnerStatementData,
  ReportDocumentData,
  ReceiptDocumentData,
  TenantStatementData,
  TrialBalanceDocumentData,
} from './documentCompatibilityTypes';
import type {
  BalanceSheetReportPayload,
  ContractDocumentPayload,
  GenericReportPayload,
  IncomeStatementReportPayload,
  InvoiceDocumentPayload,
  OwnerStatementPayload,
  ReceiptDocumentPayload,
  TenantStatementPayload,
  TrialBalanceReportPayload,
} from './documentPayloads';

/** Compatibility-data adapters used by callers while they move to the typed service boundary. */
export const toContractDocumentPayload = (data: ContractDocumentData): ContractDocumentPayload => ({
  reference: deriveHonestReference(data.contractNumber, data.contractId),
  status: data.contractStatus ?? 'draft',
  startDate: data.startDate ?? null,
  endDate: data.endDate ?? null,
  rentAmount: data.rentAmount,
  paymentCycle: data.paymentCycle ?? null,
  notes: data.notes ?? null,
  tenantName: data.tenantName ?? null,
  tenantNationalId: data.tenantNationalId ?? null,
  tenantPhone: data.tenantPhone ?? null,
  propertyTitle: data.propertyName ?? null,
  unitNumber: data.unitNumber ?? null,
});

export const toInvoiceDocumentPayload = (data: InvoiceDocumentData): InvoiceDocumentPayload => ({
  reference: deriveHonestReference(data.invoiceNumber),
  issueDate: data.issueDate ?? null,
  dueDate: data.dueDate ?? null,
  status: null,
  description: data.description ?? null,
  amount: data.amount,
  vatAmount: data.vatAmount ?? null,
  paidAmount: data.paidAmount ?? null,
  totalAmount: data.totalAmount ?? null,
  tenantName: data.tenantName ?? null,
  propertyTitle: data.propertyName ?? null,
  unitNumber: data.unitNumber ?? null,
});

export const toReceiptDocumentPayload = (data: ReceiptDocumentData): ReceiptDocumentPayload => ({
  reference: deriveHonestReference(data.receiptNumber),
  paymentDate: data.paymentDate ?? null,
  amount: data.amount,
  paymentMethod: data.paymentMethod ?? null,
  payerName: data.tenantName ?? null,
  propertyTitle: data.propertyName ?? null,
  unitNumber: data.unitNumber ?? null,
  invoiceReference: data.invoiceNumber ?? null,
  collectorName: data.collectedBy ?? null,
  paymentReference: data.reference ?? null,
  notes: data.notes ?? null,
});

export const toOwnerStatementDocumentPayload = (data: OwnerStatementData): OwnerStatementPayload => ({
  ownerName: data.ownerName,
  periodFrom: data.periodFrom ?? null,
  periodTo: data.periodTo ?? null,
  propertyTitle: data.propertyTitle ?? null,
  totalRent: data.totalRent,
  totalExpenses: data.totalExpenses,
  totalCommission: data.totalCommission,
  netAmount: data.netAmount,
  transactions: data.transactions,
});

export const toTenantStatementDocumentPayload = (data: TenantStatementData): TenantStatementPayload => ({
  tenantName: data.tenantName,
  periodFrom: data.periodFrom ?? null,
  periodTo: data.periodTo ?? null,
  propertyTitle: data.propertyTitle ?? null,
  unitNumber: data.unitNumber ?? null,
  openingBalance: data.openingBalance,
  totalInvoiced: data.totalInvoiced,
  totalPaid: data.totalPaid,
  closingBalance: data.closingBalance,
  lines: data.lines,
});

export const toTrialBalanceDocumentPayload = (data: TrialBalanceDocumentData): TrialBalanceReportPayload => ({
  asOf: data.asOf ?? null,
  lines: data.accounts.map((account) => ({
    no: account.code,
    name: account.name,
    debit: account.balanceType === 'debit' ? account.balance : 0,
    credit: account.balanceType === 'credit' ? account.balance : 0,
  })),
  totalDebit: data.totalDebits,
  totalCredit: data.totalCredits,
});

export const toIncomeStatementDocumentPayload = (data: IncomeStatementDocumentData): IncomeStatementReportPayload => ({
  periodFrom: data.periodFrom ?? null,
  periodTo: data.periodTo ?? null,
  revenues: data.revenue,
  expenses: data.expenses,
  totalRevenue: data.totalRevenue,
  totalExpense: data.totalExpenses,
  netIncome: data.netIncome,
});

export const toBalanceSheetDocumentPayload = (data: BalanceSheetDocumentData): BalanceSheetReportPayload => ({
  asOf: data.asOf ?? null,
  assets: data.assets.map((item) => ({ label: item.name, amount: item.amount })),
  liabilities: data.liabilities.map((item) => ({ label: item.name, amount: item.amount })),
  equity: data.equity.map((item) => ({ label: item.name, amount: item.amount })),
  totalAssets: data.totalAssets,
  totalLiabilities: data.totalLiabilities,
  totalEquity: data.totalEquity,
});

export const toReportDocumentPayload = (data: ReportDocumentData): GenericReportPayload => ({
  reportTitle: data.reportTitle,
  reportType: data.reportType ?? null,
  periodFrom: data.periodFrom ?? null,
  periodTo: data.periodTo ?? null,
  sections: data.sections.map((section) => {
    const isArrayRows = section.rows.length > 0 && Array.isArray(section.rows[0]);
    return {
      title: section.title,
      columns: section.columns,
      rows: isArrayRows
        ? (section.rows as Array<Array<string | number>>).map((row) => row.map(String))
        : (section.rows as Array<{ label: string; value: string | number }>).map((row) => [row.label, String(row.value)]),
      totals: section.totals,
    };
  }),
  totalSummary: data.totalSummary ?? null,
});
