import type { Contract, Expense, Invoice, Person, Property, Receipt, Unit } from '@/types/domain';
import type { OwnerStatementDataPayload, TenantStatementDataPayload } from './documents/DocumentEngine';

type AppLikeDb = {
  settings: Record<string, unknown>;
  contracts: Contract[];
  tenants: Person[];
  units: Unit[];
  properties: Property[];
  receipts?: Receipt[];
};

type TrialBalanceInput = { lines: Array<{ no: string; name: string; debit: number; credit: number }>; totalDebit: number; totalCredit: number };
type PdfRow = { label: string; amount: number };

// documentService pulls in jsPDF + html2canvas (~600 KB uncompressed) at import
// time. Loading it lazily keeps that weight out of every page bundle that
// merely needs the ability to export a PDF, and pulls it in only at the
// moment a user actually triggers an export.
const render = (type: string, payload: unknown): void => {
  void import('./documents/DocumentService').then(({ documentService }) => documentService.renderPdf({ type, payload }));
};

export const exportInvoiceToPdf = (invoice: Invoice, db: AppLikeDb): void => render('invoice', { invoice, db });
export const exportContractToPdf = (contract: Contract, db: AppLikeDb): void => render('contract', { contract, db });
export const exportReceiptToPdf = (receipt: Receipt, db: AppLikeDb): void => render('receipt', { receipt, db });
export const exportExpenseToPdf = (expense: Expense, db: AppLikeDb): void => render('expense_voucher', { expense, db });
export const exportOwnerStatementToPdf = (data: OwnerStatementDataPayload, db: AppLikeDb): void => render('owner_statement', { data, db });
export const exportTenantStatementToPdf = (data: TenantStatementDataPayload, db: AppLikeDb): void => render('tenant_statement', { data, db });
export const exportTrialBalanceToPdf = (trial: TrialBalanceInput, settings: Record<string, unknown>, endDate: string): void => render('trial_balance', { trial, settings, endDate });
export const exportIncomeStatementToPdf = (pnlData: { totalRevenue: number; totalExpense: number; netIncome: number; revenues: PdfRow[]; expenses: PdfRow[] }, settings: Record<string, unknown>, dateRange: string): void => render('income_statement', { pnlData, settings, dateRange });
export const exportBalanceSheetToPdf = (data: { assets: PdfRow[]; liabilities: PdfRow[]; equity: PdfRow[]; totalAssets: number; totalLiabilities: number; totalEquity: number }, settings: Record<string, unknown>, date: string): void => render('balance_sheet', { data, settings, date });
