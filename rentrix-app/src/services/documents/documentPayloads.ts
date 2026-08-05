/**
 * Canonical document payload contract.
 *
 * `DocumentEngine.buildDocument(type, { settings, payload })` is the single
 * source of truth for building a `UnifiedDocumentModel`. Each document type
 * has one typed payload here; legacy request shapes are normalized into
 * these payloads by `legacyPayloadAdapters.ts`, and the compatibility
 * wrappers in `DocumentTemplates.tsx` map their historical data interfaces
 * onto them as well. No financial values are invented anywhere: every field
 * mirrors data the caller already holds.
 */
import type { DocumentCompanySettings } from './companyIdentity';

export type DocumentTypeId =
  | 'contract'
  | 'invoice'
  | 'receipt'
  | 'expense_voucher'
  | 'payment'
  | 'owner_statement'
  | 'tenant_statement'
  | 'trial_balance'
  | 'income_statement'
  | 'balance_sheet'
  | 'generic_report';

export type ContractDocumentPayload = {
  /** Real business reference when one exists. Never a UUID fragment. */
  reference?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  rentAmount: number;
  paymentCycle?: string | null;
  notes?: string | null;
  tenantName?: string | null;
  tenantNationalId?: string | null;
  tenantPhone?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
};

export type InvoiceDocumentPayload = {
  reference?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  description?: string | null;
  amount: number;
  /** Present only when the data source tracks partial payments. */
  paidAmount?: number | null;
  vatAmount?: number | null;
  /** Explicit caller-computed total; when absent amount + vat is shown. */
  totalAmount?: number | null;
  tenantName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
};

export type ReceiptDocumentPayload = {
  /** The real receipt number (e.g. REC-…). Absent when the source has none. */
  reference?: string | null;
  paymentDate?: string | null;
  amount: number;
  paymentMethod?: string | null;
  payerName?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  invoiceReference?: string | null;
  collectorName?: string | null;
  /** Physical payment reference (cheque / transfer number), not the receipt no. */
  paymentReference?: string | null;
  notes?: string | null;
};

export type ExpenseVoucherPayload = {
  reference?: string | null;
  date?: string | null;
  category?: string | null;
  amount: number;
  description?: string | null;
  propertyTitle?: string | null;
  /**
   * `payment` stays a documented legacy alias: no live caller owns it, so it
   * renders as a neutral money-movement voucher rather than pretending to be
   * a dedicated payment design.
   */
  kind: 'expense' | 'payment';
};

export type StatementTransaction = {
  date: string;
  type: string;
  description: string;
  amount: number;
};

export type OwnerStatementPayload = {
  ownerName: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  propertyTitle?: string | null;
  totalRent: number;
  totalExpenses: number;
  totalCommission: number;
  netAmount: number;
  transactions: StatementTransaction[];
};

export type TenantStatementLine = {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type TenantStatementPayload = {
  tenantName: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  lines: TenantStatementLine[];
};

export type TrialBalanceLine = {
  no: string;
  name: string;
  debit: number;
  credit: number;
};

export type TrialBalanceReportPayload = {
  asOf?: string | null;
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
};

export type MoneyRow = { label: string; amount: number };

export type IncomeStatementReportPayload = {
  periodFrom?: string | null;
  periodTo?: string | null;
  /** Pre-formatted period label for legacy callers that already built one. */
  dateRangeLabel?: string | null;
  revenues: MoneyRow[];
  expenses: MoneyRow[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
};

export type BalanceSheetReportPayload = {
  asOf?: string | null;
  assets: MoneyRow[];
  liabilities: MoneyRow[];
  equity: MoneyRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

export type GenericReportSection = {
  title?: string;
  columns?: string[];
  rows: string[][];
  totals?: string[];
};

/**
 * Generic report is supported because real callers use it today (collections,
 * overdue, occupancy, expenses, maintenance, deferred revenue, property
 * analytics reports, deposits clearance, maintenance A4 list, utilities
 * report). It is not a speculative extension point.
 */
export type GenericReportPayload = {
  reportTitle: string;
  reportType?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  sections: GenericReportSection[];
  totalSummary?: string | null;
};

export type CanonicalDocumentPayloadMap = {
  contract: ContractDocumentPayload;
  invoice: InvoiceDocumentPayload;
  receipt: ReceiptDocumentPayload;
  expense_voucher: ExpenseVoucherPayload;
  payment: ExpenseVoucherPayload;
  owner_statement: OwnerStatementPayload;
  tenant_statement: TenantStatementPayload;
  trial_balance: TrialBalanceReportPayload;
  income_statement: IncomeStatementReportPayload;
  balance_sheet: BalanceSheetReportPayload;
  generic_report: GenericReportPayload;
};

export type DocumentBuildInput<T extends DocumentTypeId> = {
  settings: DocumentCompanySettings;
  payload: CanonicalDocumentPayloadMap[T];
};
