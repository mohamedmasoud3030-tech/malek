import type { Contract, Expense, Invoice, Person, Property, Receipt, Unit } from '@/types/domain';
import type { OwnerStatementDataPayload, TenantStatementDataPayload } from './documents/DocumentEngine';
import type { LegacyDocumentSettingsIdentity } from './documents/legacyPayloadAdapters';

/**
 * Legacy PDF export adapters (compatibility layer).
 *
 * Historical behavior was fire-and-forget: `void import(...).then(...)`
 * swallowed every rejection, so render failures (missing company identity,
 * popup issues, PDF generation errors) never reached the user. These
 * adapters now RETURN the render promise so callers must await it and
 * surface `DocumentRenderError` / `MissingDocumentSettingsError`.
 *
 * `documentService` (which pulls jsPDF + html2canvas at import time only on
 * use) is still loaded lazily, keeping that weight out of page bundles.
 *
 * This layer is removed once its remaining (test-only) callers migrate to
 * the canonical `documentService` typed API.
 */
type LegacyCompanyIdentityShape = Partial<LegacyDocumentSettingsIdentity>;

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

/**
 * Normalizes the two historical settings containers into the legacy engine
 * identity shape. Supports the raw `{ company: {...} }` form and the old UI
 * state form `{ general: { company }, operational: { currency } }`. Any
 * gap stays empty — it surfaces as `MissingDocumentSettingsError` later
 * rather than being filled with a brand-name fallback.
 */
function normalizeLegacySettings(settings: Record<string, unknown> | null | undefined): { company: LegacyDocumentSettingsIdentity } {
  const container = settings ?? {};
  const direct = (container.company ?? null) as LegacyCompanyIdentityShape | null;
  const general = (container.general ?? null) as { company?: LegacyCompanyIdentityShape & { name?: string | null } } | null;
  const operational = (container.operational ?? null) as { currency?: string | null } | null;
  const companySource = direct ?? general?.company ?? {};
  const companyName =
    (typeof companySource.companyName === 'string' && companySource.companyName)
    || (typeof (companySource as { name?: string | null }).name === 'string' ? (companySource as { name?: string | null }).name : null)
    || '';
  return {
    company: {
      companyName: companyName ?? '',
      address: companySource.address ?? null,
      phone: companySource.phone ?? null,
      email: companySource.email ?? null,
      logoUrl: companySource.logoUrl ?? null,
      taxNumber: companySource.taxNumber ?? null,
      registrationNumber: companySource.registrationNumber ?? null,
      defaultCurrency:
        (typeof companySource.defaultCurrency === 'string' && companySource.defaultCurrency)
        || operational?.currency
        || '',
    },
  };
}

/** Wraps legacy requests that passed `settings` beside the payload into the `{ db }` container the engine expects. */
function withDb<T extends object>(payload: T, settings: Record<string, unknown>): T & { db: object } {
  return {
    ...payload,
    db: {
      settings: normalizeLegacySettings(settings),
      contracts: [],
      tenants: [],
      units: [],
      properties: [],
    },
  };
}

const render = (type: string, payload: unknown): Promise<void> =>
  import('./documents/DocumentService').then(({ documentService }) => documentService.downloadPdf({ type, payload }));

const normalizeDbSettings = (db: AppLikeDb): AppLikeDb => ({ ...db, settings: normalizeLegacySettings(db.settings) });

export const exportInvoiceToPdf = (invoice: Invoice, db: AppLikeDb): Promise<void> => render('invoice', { invoice, db: normalizeDbSettings(db) });
export const exportContractToPdf = (contract: Contract, db: AppLikeDb): Promise<void> => render('contract', { contract, db: normalizeDbSettings(db) });
export const exportReceiptToPdf = (receipt: Receipt, db: AppLikeDb): Promise<void> => render('receipt', { receipt, db: normalizeDbSettings(db) });
export const exportExpenseToPdf = (expense: Expense, db: AppLikeDb): Promise<void> => render('expense_voucher', { expense, db: normalizeDbSettings(db) });
export const exportOwnerStatementToPdf = (data: OwnerStatementDataPayload, db: AppLikeDb): Promise<void> => render('owner_statement', { data, db: normalizeDbSettings(db) });
export const exportTenantStatementToPdf = (data: TenantStatementDataPayload, db: AppLikeDb): Promise<void> => render('tenant_statement', { data, db: normalizeDbSettings(db) });
export const exportTrialBalanceToPdf = (trial: TrialBalanceInput, settings: Record<string, unknown>, endDate: string): Promise<void> =>
  render('trial_balance', withDb({ trial, endDate }, settings));
export const exportIncomeStatementToPdf = (
  pnlData: { totalRevenue: number; totalExpense: number; netIncome: number; revenues: PdfRow[]; expenses: PdfRow[] },
  settings: Record<string, unknown>,
  dateRange: string,
): Promise<void> => render('income_statement', withDb({ pnlData, dateRange }, settings));
export const exportBalanceSheetToPdf = (
  data: { assets: PdfRow[]; liabilities: PdfRow[]; equity: PdfRow[]; totalAssets: number; totalLiabilities: number; totalEquity: number },
  settings: Record<string, unknown>,
  date: string,
): Promise<void> => render('balance_sheet', withDb({ data, date }, settings));
