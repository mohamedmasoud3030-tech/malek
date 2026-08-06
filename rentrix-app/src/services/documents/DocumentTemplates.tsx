/**
 * DocumentTemplates — compatibility adapters (thin by design).
 *
 * Historically this module contained a second, full set of document
 * builders that duplicated `DocumentEngine`. That duplication is gone:
 * these functions now only translate their historical data interfaces into
 * the canonical payloads of `documentPayloads.ts` and call the single
 * public boundary — `documentService`. Every exported name and data
 * interface is preserved so existing callers keep working during the
 * caller-migration phase; the adapters themselves are removed once all
 * callers move to the canonical typed API.
 *
 * Truthfulness preserved at this layer:
 *  - company identity is asserted through the canonical contract (no
 *    fallback brand name, address, phone, or currency);
 *  - historical `id.slice(0, 8)` "document numbers" are dropped by
 *    `deriveHonestReference` — only real references are shown;
 *  - print and PDF remain two distinct renderer operations.
 */
import {
  assertDocumentCompanySettings,
  deriveHonestReference,
  MissingDocumentSettingsError,
  type DocumentCompanySettings,
} from './companyIdentity';
import { documentService } from './DocumentService';
import { DocumentRenderError } from './DocumentRenderer';

export { MissingDocumentSettingsError };

export interface ContractDocumentData {
  contractId: string;
  contractNumber: string;
  contractStatus?: 'draft' | 'active' | 'expired' | 'terminated';
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  tenantNationalId: string;
  propertyName: string;
  unitNumber: string;
  unitFloor?: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentCycle: string;
  vatRate?: number;
  notes?: string;
}

export interface InvoiceDocumentData {
  invoiceNumber: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  description: string;
  amount: number;
  vatAmount?: number;
  totalAmount: number;
  dueDate: string;
  issueDate: string;
}

export interface ReceiptDocumentData {
  receiptNumber: string;
  paymentDate: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  collectedBy?: string;
  notes?: string;
}

export interface OwnerStatementData {
  ownerName: string;
  ownerPhone?: string;
  periodFrom: string;
  periodTo: string;
  propertyTitle: string;
  totalRent: number;
  totalExpenses: number;
  totalCommission: number;
  netAmount: number;
  transactions: Array<{
    date: string;
    type: string;
    description: string;
    amount: number;
  }>;
}

export interface TenantStatementData {
  tenantName: string;
  tenantPhone?: string;
  periodFrom: string;
  periodTo: string;
  propertyTitle: string;
  unitNumber: string;
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  lines: Array<{
    date: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
}

export interface ReportDocumentData {
  reportTitle: string;
  reportType: string;
  periodFrom: string;
  periodTo: string;
  sections: Array<{
    title: string;
    columns?: string[];
    rows: Array<Array<string | number>> | Array<{ label: string; value: string | number }>;
    totals?: string[];
  }>;
  totalSummary?: string;
}

export interface TrialBalanceDocumentData {
  asOf: string;
  accounts: Array<{
    code: string;
    name: string;
    balanceType: 'debit' | 'credit';
    balance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface IncomeStatementDocumentData {
  periodFrom: string;
  periodTo: string;
  revenue: Array<{ label: string; amount: number }>;
  expenses: Array<{ label: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheetDocumentData {
  asOf: string;
  assets: Array<{ name: string; amount: number }>;
  liabilities: Array<{ name: string; amount: number }>;
  equity: Array<{ name: string; amount: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface CompanyInfo {
  name: string;
  legalName?: string;
  taxNumber?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  vatRegistrationNumber?: string;
}

export interface DocumentSettings {
  company: CompanyInfo;
  currency: string;
  currencySymbol?: string;
  locale?: string;
  invoicePrefix?: string;
  contractPrefix?: string;
  receiptPrefix?: string;
}

/** Adapts the compatibility settings shape into the canonical contract (asserted). */
export function toCanonicalDocumentSettings(settings: DocumentSettings): DocumentCompanySettings {
  return assertDocumentCompanySettings({
    companyName: settings?.company?.name ?? '',
    legalName: settings?.company?.legalName ?? null,
    taxNumber: settings?.company?.taxNumber ?? null,
    registrationNumber: settings?.company?.registrationNumber ?? null,
    phone: settings?.company?.phone ?? null,
    email: settings?.company?.email ?? null,
    address: settings?.company?.address ?? null,
    logoUrl: settings?.company?.logoUrl ?? null,
    currency: settings?.currency ?? '',
    currencySymbol: settings?.currencySymbol ?? null,
    documentPrefixes: {
      invoice: settings?.invoicePrefix ?? null,
      contract: settings?.contractPrefix ?? null,
      receipt: settings?.receiptPrefix ?? null,
    },
  });
}

async function runOrThrow(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof DocumentRenderError || error instanceof MissingDocumentSettingsError) throw error;
    throw new DocumentRenderError('تعذر تنفيذ العملية على المستند. يرجى إعادة المحاولة.', error);
  }
}

const toContractPayload = (data: ContractDocumentData) => ({
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

const toInvoicePayload = (data: InvoiceDocumentData) => ({
  reference: deriveHonestReference(data.invoiceNumber),
  issueDate: data.issueDate ?? null,
  dueDate: data.dueDate ?? null,
  status: null,
  description: data.description ?? null,
  amount: data.amount,
  vatAmount: data.vatAmount ?? null,
  totalAmount: data.totalAmount,
  tenantName: data.tenantName ?? null,
  propertyTitle: data.propertyName ?? null,
  unitNumber: data.unitNumber ?? null,
});

const toReceiptPayload = (data: ReceiptDocumentData) => ({
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

const toOwnerStatementPayload = (data: OwnerStatementData) => ({
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

const toTenantStatementPayload = (data: TenantStatementData) => ({
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

const toTrialBalancePayload = (data: TrialBalanceDocumentData) => ({
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

const toIncomeStatementPayload = (data: IncomeStatementDocumentData) => ({
  periodFrom: data.periodFrom ?? null,
  periodTo: data.periodTo ?? null,
  revenues: data.revenue,
  expenses: data.expenses,
  totalRevenue: data.totalRevenue,
  totalExpense: data.totalExpenses,
  netIncome: data.netIncome,
});

const toBalanceSheetPayload = (data: BalanceSheetDocumentData) => ({
  asOf: data.asOf ?? null,
  assets: data.assets.map((item) => ({ label: item.name, amount: item.amount })),
  liabilities: data.liabilities.map((item) => ({ label: item.name, amount: item.amount })),
  equity: data.equity.map((item) => ({ label: item.name, amount: item.amount })),
  totalAssets: data.totalAssets,
  totalLiabilities: data.totalLiabilities,
  totalEquity: data.totalEquity,
});

const toReportPayload = (data: ReportDocumentData) => ({
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

export function printContractDocument(data: ContractDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('contract', { settings: toCanonicalDocumentSettings(settings), payload: toContractPayload(data) }));
}
export function downloadContractPdf(data: ContractDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('contract', { settings: toCanonicalDocumentSettings(settings), payload: toContractPayload(data) }));
}

export function printInvoiceDocument(data: InvoiceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('invoice', { settings: toCanonicalDocumentSettings(settings), payload: toInvoicePayload(data) }));
}
export function downloadInvoicePdf(data: InvoiceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('invoice', { settings: toCanonicalDocumentSettings(settings), payload: toInvoicePayload(data) }));
}

export function printReceiptDocument(data: ReceiptDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('receipt', { settings: toCanonicalDocumentSettings(settings), payload: toReceiptPayload(data) }));
}
export function downloadReceiptPdf(data: ReceiptDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('receipt', { settings: toCanonicalDocumentSettings(settings), payload: toReceiptPayload(data) }));
}

export function printOwnerStatementDocument(data: OwnerStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('owner_statement', { settings: toCanonicalDocumentSettings(settings), payload: toOwnerStatementPayload(data) }));
}
export function downloadOwnerStatementPdf(data: OwnerStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('owner_statement', { settings: toCanonicalDocumentSettings(settings), payload: toOwnerStatementPayload(data) }));
}

export function printTenantStatementDocument(data: TenantStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('tenant_statement', { settings: toCanonicalDocumentSettings(settings), payload: toTenantStatementPayload(data) }));
}
export function downloadTenantStatementPdf(data: TenantStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('tenant_statement', { settings: toCanonicalDocumentSettings(settings), payload: toTenantStatementPayload(data) }));
}

export function printTrialBalanceDocument(data: TrialBalanceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('trial_balance', { settings: toCanonicalDocumentSettings(settings), payload: toTrialBalancePayload(data) }));
}
export function downloadTrialBalancePdf(data: TrialBalanceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('trial_balance', { settings: toCanonicalDocumentSettings(settings), payload: toTrialBalancePayload(data) }));
}

export function printIncomeStatementDocument(data: IncomeStatementDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('income_statement', { settings: toCanonicalDocumentSettings(settings), payload: toIncomeStatementPayload(data) }));
}
export function downloadIncomeStatementPdf(data: IncomeStatementDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('income_statement', { settings: toCanonicalDocumentSettings(settings), payload: toIncomeStatementPayload(data) }));
}

export function printBalanceSheetDocument(data: BalanceSheetDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('balance_sheet', { settings: toCanonicalDocumentSettings(settings), payload: toBalanceSheetPayload(data) }));
}
export function downloadBalanceSheetPdf(data: BalanceSheetDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('balance_sheet', { settings: toCanonicalDocumentSettings(settings), payload: toBalanceSheetPayload(data) }));
}

export function printReportDocument(data: ReportDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('generic_report', { settings: toCanonicalDocumentSettings(settings), payload: toReportPayload(data) }));
}
export function downloadReportPdf(data: ReportDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('generic_report', { settings: toCanonicalDocumentSettings(settings), payload: toReportPayload(data) }));
}

export const DocumentTemplates = {
  printContractDocument,
  downloadContractPdf,
  printInvoiceDocument,
  downloadInvoicePdf,
  printReceiptDocument,
  downloadReceiptPdf,
  printOwnerStatementDocument,
  downloadOwnerStatementPdf,
  printTenantStatementDocument,
  downloadTenantStatementPdf,
  printTrialBalanceDocument,
  downloadTrialBalancePdf,
  printIncomeStatementDocument,
  downloadIncomeStatementPdf,
  printBalanceSheetDocument,
  downloadBalanceSheetPdf,
  printReportDocument,
  downloadReportPdf,
};

export default DocumentTemplates;
