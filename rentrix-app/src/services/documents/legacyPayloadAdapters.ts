/**
 * Legacy payload adapters.
 *
 * The historical engine contract was `build({ type, payload })` where each
 * payload bundled raw DB rows plus an `AppLikeDb` ({ invoices+db, trial+db,
 * …}). These adapters normalize those shapes — and only those shapes —
 * into the canonical payloads of `documentPayloads.ts`. Truthfulness rules
 * applied here:
 *
 *  - no document reference is fabricated; historical `id.slice(0, 8)`
 *    references are dropped by `deriveHonestReference`;
 *  - financial figures pass through unchanged (no re-calculation);
 *  - company identity keeps flowing through one asserted adapter.
 */
import type { Contract, Expense, Invoice, Person, Property, Receipt, Unit } from '@/types/domain';
import { deriveHonestReference, type DocumentCompanySettings } from './companyIdentity';
import type {
  BalanceSheetReportPayload,
  ContractDocumentPayload,
  ExpenseVoucherPayload,
  GenericReportPayload,
  IncomeStatementReportPayload,
  InvoiceDocumentPayload,
  OwnerStatementPayload,
  ReceiptDocumentPayload,
  TenantStatementPayload,
  TrialBalanceReportPayload,
} from './documentPayloads';

/** Historical `db.settings` shape ({ company: { companyName, defaultCurrency } }). */
export type LegacyDocumentSettingsIdentity = Readonly<{
  companyName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  defaultCurrency: string;
}>;

export type LegacyAppLikeDb = {
  settings: { company: LegacyDocumentSettingsIdentity };
  contracts?: Contract[];
  tenants?: Person[];
  units?: Unit[];
  properties?: Property[];
  receipts?: Receipt[];
};

/** Adapts the historical engine settings container into the canonical contract. */
export function legacySettingsToCanonical(settings: { company: LegacyDocumentSettingsIdentity }): DocumentCompanySettings {
  const company = settings.company;
  return {
    companyName: company.companyName ?? '',
    legalName: null,
    registrationNumber: company.registrationNumber ?? null,
    taxNumber: company.taxNumber ?? null,
    address: company.address ?? null,
    phone: company.phone ?? null,
    email: company.email ?? null,
    logoUrl: company.logoUrl ?? null,
    currency: company.defaultCurrency ?? '',
    currencySymbol: null,
    documentPrefixes: {},
  };
}

type JoinedContractContext = {
  contract?: Contract;
  tenant?: Person;
  unit?: Unit;
  property?: Property;
};

function resolveContractContext(db: LegacyAppLikeDb, contractId: string | null | undefined): JoinedContractContext {
  const contract = db.contracts?.find((candidate) => candidate.id === contractId);
  const tenant = contract ? db.tenants?.find((candidate) => candidate.id === contract.tenant_id) : undefined;
  const unit = contract ? db.units?.find((candidate) => candidate.id === contract.unit_id) : undefined;
  const property =
    (unit ? db.properties?.find((candidate) => candidate.id === unit.property_id) : undefined) ??
    (contract ? db.properties?.find((candidate) => candidate.id === contract.property_id) : undefined);
  return { contract, tenant, unit, property };
}

export function legacyInvoiceToCanonical({ invoice, db }: { invoice: Invoice; db: LegacyAppLikeDb }): InvoiceDocumentPayload {
  const { tenant, unit, property } = resolveContractContext(db, invoice.contract_id);
  return {
    // The invoices table stores no business number; never show a UUID slice.
    reference: null,
    issueDate: invoice.issue_date ?? null,
    dueDate: invoice.due_date ?? null,
    status: invoice.status ?? null,
    description: invoice.notes?.trim() || 'مطالبة إيجارية مستحقة',
    amount: Number(invoice.amount ?? 0),
    paidAmount: Number(invoice.paid_amount ?? 0),
    tenantName: tenant?.full_name ?? null,
    propertyTitle: property?.title ?? null,
    unitNumber: unit?.unit_number ?? null,
  };
}

export function legacyContractToCanonical({ contract, db }: { contract: Contract; db: LegacyAppLikeDb }): ContractDocumentPayload {
  const tenant = db.tenants?.find((candidate) => candidate.id === contract.tenant_id);
  const unit = db.units?.find((candidate) => candidate.id === contract.unit_id);
  const property =
    (unit ? db.properties?.find((candidate) => candidate.id === unit.property_id) : undefined) ??
    db.properties?.find((candidate) => candidate.id === contract.property_id);
  return {
    reference: null,
    status: contract.status,
    startDate: contract.start_date ?? null,
    endDate: contract.end_date ?? null,
    rentAmount: Number(contract.rent_amount ?? 0),
    paymentCycle: contract.payment_cycle ?? null,
    notes: contract.notes ?? null,
    tenantName: tenant?.full_name ?? null,
    tenantNationalId: tenant?.national_id ?? null,
    tenantPhone: tenant?.phone ?? null,
    propertyTitle: property?.title ?? null,
    unitNumber: unit?.unit_number ?? null,
  };
}

export function legacyReceiptToCanonical({ receipt, db }: { receipt: Receipt; db: LegacyAppLikeDb }): ReceiptDocumentPayload {
  const invoice = receipt.invoices?.[0];
  const { tenant, unit, property } = invoice ? resolveContractContext(db, invoice.contract_id) : {};
  return {
    reference: null,
    paymentDate: receipt.payment_date ?? null,
    amount: Number(receipt.amount ?? 0),
    paymentMethod: receipt.payment_method ?? null,
    payerName: tenant?.full_name ?? null,
    propertyTitle: property?.title ?? null,
    unitNumber: unit?.unit_number ?? null,
    paymentReference: deriveHonestReference(receipt.reference_number, receipt.id),
    notes: receipt.notes ?? null,
  };
}

export function legacyExpenseToCanonical({ expense, db, kind = 'expense' }: { expense: Expense; db: LegacyAppLikeDb; kind?: 'expense' | 'payment' }): ExpenseVoucherPayload {
  const property = expense.property_id ? db.properties?.find((candidate) => candidate.id === expense.property_id) : undefined;
  return {
    reference: null,
    date: expense.expense_date ?? null,
    category: expense.category ?? null,
    amount: Number(expense.amount ?? 0),
    description: expense.description ?? null,
    propertyTitle: property?.title ?? null,
    kind,
  };
}

export type LegacyOwnerStatementPayload = {
  ownerName: string;
  ownerPhone?: string;
  periodFrom: string;
  periodTo: string;
  propertyTitle: string;
  totalRent: number;
  totalExpenses: number;
  totalCommission: number;
  netAmount: number;
  transactions: Array<{ date: string; type: string; description: string; amount: number }>;
};

export const legacyOwnerStatementToCanonical = ({ data }: { data: LegacyOwnerStatementPayload }): OwnerStatementPayload => ({
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

export type LegacyTenantStatementPayload = {
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
  lines: Array<{ date: string; type: string; description: string; debit: number; credit: number; balance: number }>;
};

export const legacyTenantStatementToCanonical = ({ data }: { data: LegacyTenantStatementPayload }): TenantStatementPayload => ({
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

export type LegacyTrialBalancePayload = {
  trial: {
    lines: Array<{ no: string; name: string; debit: number; credit: number }>;
    totalDebit: number;
    totalCredit: number;
  };
  endDate: string;
};

export const legacyTrialBalanceToCanonical = ({ trial, endDate }: LegacyTrialBalancePayload): TrialBalanceReportPayload => ({
  asOf: endDate ?? null,
  lines: trial.lines.map((line) => ({
    no: line.no,
    name: line.name,
    debit: line.debit,
    credit: line.credit,
  })),
  totalDebit: trial.totalDebit,
  totalCredit: trial.totalCredit,
});

export type LegacyIncomeStatementPayload = {
  pnlData: {
    totalRevenue: number;
    totalExpense: number;
    netIncome: number;
    revenues: Array<{ label: string; amount: number }>;
    expenses: Array<{ label: string; amount: number }>;
  };
  dateRange: string;
};

export const legacyIncomeStatementToCanonical = ({ pnlData, dateRange }: LegacyIncomeStatementPayload): IncomeStatementReportPayload => ({
  dateRangeLabel: dateRange ?? null,
  revenues: pnlData.revenues,
  expenses: pnlData.expenses,
  totalRevenue: pnlData.totalRevenue,
  totalExpense: pnlData.totalExpense,
  netIncome: pnlData.netIncome,
});

export type LegacyBalanceSheetPayload = {
  data: {
    assets: Array<{ label: string; amount: number }>;
    liabilities: Array<{ label: string; amount: number }>;
    equity: Array<{ label: string; amount: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  date: string;
};

export const legacyBalanceSheetToCanonical = ({ data, date }: LegacyBalanceSheetPayload): BalanceSheetReportPayload => ({
  asOf: date ?? null,
  assets: data.assets,
  liabilities: data.liabilities,
  equity: data.equity,
  totalAssets: data.totalAssets,
  totalLiabilities: data.totalLiabilities,
  totalEquity: data.totalEquity,
});

export type LegacyGenericReportPayload = GenericReportPayload;

export type NormalizedLegacyRequest =
  | { kind: 'invoice'; settings: DocumentCompanySettings; payload: InvoiceDocumentPayload }
  | { kind: 'contract'; settings: DocumentCompanySettings; payload: ContractDocumentPayload }
  | { kind: 'receipt'; settings: DocumentCompanySettings; payload: ReceiptDocumentPayload }
  | { kind: 'expense_voucher'; settings: DocumentCompanySettings; payload: ExpenseVoucherPayload }
  | { kind: 'payment'; settings: DocumentCompanySettings; payload: ExpenseVoucherPayload }
  | { kind: 'owner_statement'; settings: DocumentCompanySettings; payload: OwnerStatementPayload }
  | { kind: 'tenant_statement'; settings: DocumentCompanySettings; payload: TenantStatementPayload }
  | { kind: 'trial_balance'; settings: DocumentCompanySettings; payload: TrialBalanceReportPayload }
  | { kind: 'income_statement'; settings: DocumentCompanySettings; payload: IncomeStatementReportPayload }
  | { kind: 'balance_sheet'; settings: DocumentCompanySettings; payload: BalanceSheetReportPayload }
  | { kind: 'generic_report'; settings: DocumentCompanySettings; payload: GenericReportPayload };
