import { supabase } from '@/lib/supabase';
import type { Contract, Expense, Invoice, Payment, Person, Property, Unit } from '@/types/domain';
import { getSafeRemainingAmount, sumFinancialValues, toFinancialNumber } from '../financialMath';

export type FinancialReportStatus = Invoice['status'] | 'all';

export type FinancialReportFilters = {
  dateFrom: string;
  dateTo: string;
  propertyId?: string;
  tenantId?: string;
  contractId?: string;
  costCenterId?: string;
  status?: FinancialReportStatus;
};

export type InvoiceTotalsReport = {
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  invoicesCount: number;
};

export type PaymentTotalsReport = {
  totalPaid: number;
  paymentsCount: number;
};

export type ExpenseTotalsReport = {
  totalExpenses: number;
  expensesCount: number;
};

export type OutstandingBalanceReport = {
  totalOutstanding: number;
  invoicesCount: number;
};

export type CollectionSummaryReport = {
  invoiced: number;
  paid: number;
  outstanding: number;
  receiptsCount: number;
  invoicesCount: number;
  expensesTotal: number;
};

export type PaymentMethodTotals = Record<Payment['payment_method'], number>;

export type DailyCollectionReportRow = {
  paymentDate: string;
  totalPaid: number;
  paymentsCount: number;
  methodTotals: PaymentMethodTotals;
};

export type DailyCollectionReport = {
  rows: DailyCollectionReportRow[];
  grandTotal: number;
  paymentsCount: number;
  methodTotals: PaymentMethodTotals;
};

export type FinancialPeriodSummaryReport = {
  invoiced: number;
  paid: number;
  outstanding: number;
  expenses: number;
  netCash: number;
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
};

export type FinancialCashflowReportRow = {
  month: string;
  revenue: number;
  expenses: number;
};

export type FinancialCashflowReport = {
  rows: FinancialCashflowReportRow[];
  totalRevenue: number;
  totalExpenses: number;
};

export type CashFlowStatementReport = {
  period: { from: string | null; to: string | null };
  operating: {
    receipts: number;
    expenses: number;
    netOperating: number;
  };
  investing: { amount: number; note: string | null };
  financing: { amount: number; note: string | null };
  netChange: number;
};

export type VatReturnReport = {
  period: { from: string | null; to: string | null };
  totalSalesAmount: number;
  totalTaxAmount: number;
  invoiceCount: number;
};

export type ExpenseBreakdownReportFilters = FinancialReportFilters & {
  category?: string;
};

export type ExpenseBreakdownCategoryRow = {
  category: string;
  total: number;
  count: number;
};

export type ExpenseBreakdownPropertyRow = {
  propertyId: string;
  propertyTitle: string | null;
  total: number;
  count: number;
};

export type ExpenseBreakdownReport = {
  totalExpenses: number;
  expensesCount: number;
  byCategory: ExpenseBreakdownCategoryRow[];
  byProperty: ExpenseBreakdownPropertyRow[];
};

export type ArrearsReportFilters = {
  asOf: string;
  propertyId?: string;
  tenantId?: string;
  contractId?: string;
};

export type AgingBucketKey = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus';

export type AgedReceivablesBucket = {
  key: AgingBucketKey;
  label: string;
  total: number;
  invoiceCount: number;
};

export type OverdueInvoiceReportRow = {
  invoiceId: string;
  shortInvoiceId: string;
  contractId: string;
  tenantId: string | null;
  tenantName: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  unitId: string | null;
  unitNumber: string | null;
  dueDate: string;
  daysOverdue: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: Invoice['status'];
};

export type AgedReceivablesGroupRow = {
  contractId: string;
  tenantId: string | null;
  tenantName: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  unitId: string | null;
  unitNumber: string | null;
  buckets: Record<AgingBucketKey, AgedReceivablesBucket>;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
};

export type AgedReceivablesReport = {
  asOf: string;
  buckets: Record<AgingBucketKey, AgedReceivablesBucket>;
  totalOutstanding: number;
  totalOverdue: number;
  rows: AgedReceivablesGroupRow[];
};

export type OverdueInvoicesReport = {
  asOf: string;
  totalOverdue: number;
  invoiceCount: number;
  rows: OverdueInvoiceReportRow[];
};

export type ArrearsSummaryReport = {
  asOf: string;
  totalOverdue: number;
  overdueInvoiceCount: number;
  over90Amount: number;
  over90InvoiceCount: number;
  averageDaysOverdue: number;
};

type ContractContext = Pick<Contract, 'id' | 'property_id' | 'tenant_id'> & { unit_id?: Contract['unit_id'] };
type InvoiceReportRow = Pick<Invoice, 'id' | 'contract_id' | 'issue_date' | 'due_date' | 'amount' | 'paid_amount' | 'status' | 'deleted_at'> & Partial<Pick<Invoice, 'tax_amount'>> & {
  contracts?: ContractContext | null;
};
type PaymentReportRow = Pick<Payment, 'id' | 'invoice_id' | 'amount' | 'payment_date' | 'payment_method' | 'status' | 'deleted_at'>;
type ExpenseReportRow = Pick<Expense, 'id' | 'property_id' | 'category' | 'amount' | 'expense_date' | 'cost_center_id' | 'deleted_at'>;
type PropertyContext = Pick<Property, 'id' | 'title'>;
type PersonContext = Pick<Person, 'id' | 'full_name'>;
type UnitContext = Pick<Unit, 'id' | 'unit_number'>;

type PaymentWithInvoiceContext = PaymentReportRow & {
  invoice: Pick<InvoiceReportRow, 'id' | 'contract_id'> | null;
  contract: ContractContext | null;
};

// Foundation note: report loaders below intentionally use bounded, batched
// current-app hydration. Base invoice/payment/expense queries are constrained by
// required date filters first, then related invoices/contracts are fetched by
// grouped id lists to avoid N+1 requests. This keeps PR #453 merge-safe while
// schema relationships settle; these loaders can later move behind Supabase
// views/RPCs or typed nested relational selects once those relationships are
// confirmed.
const invoiceReportSelect = 'id, contract_id, issue_date, due_date, amount, paid_amount, status, deleted_at, contracts:contract_id(id, property_id, tenant_id, unit_id)';
const paymentReportSelect = 'id, invoice_id, amount, payment_date, payment_method, status, deleted_at';
const expenseReportSelect = 'id, property_id, category, amount, expense_date, deleted_at';

function hasStatusFilter(status: FinancialReportFilters['status']): status is Invoice['status'] {
  return Boolean(status && status !== 'all');
}

function isWithinDateRange(value: string | null | undefined, filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) {
  if (!value) return false;
  return value >= filters.dateFrom && value <= filters.dateTo;
}

function matchesInvoiceContext(
  invoice: Pick<InvoiceReportRow, 'contract_id' | 'contracts'>,
  filters: Pick<FinancialReportFilters, 'propertyId' | 'tenantId' | 'contractId'>,
) {
  if (filters.contractId && invoice.contract_id !== filters.contractId) return false;
  if (filters.propertyId && invoice.contracts?.property_id !== filters.propertyId) return false;
  if (filters.tenantId && invoice.contracts?.tenant_id !== filters.tenantId) return false;
  return true;
}

function matchesPaymentContext(payment: PaymentWithInvoiceContext, filters: FinancialReportFilters) {
  if (filters.contractId && payment.invoice?.contract_id !== filters.contractId) return false;
  if (filters.propertyId && payment.contract?.property_id !== filters.propertyId) return false;
  if (filters.tenantId && payment.contract?.tenant_id !== filters.tenantId) return false;
  return true;
}

function matchesExpenseFilters(expense: ExpenseReportRow, filters: ExpenseBreakdownReportFilters) {
  if (expense.deleted_at) return false;
  if (!isWithinDateRange(expense.expense_date, filters)) return false;
  if (filters.propertyId && expense.property_id !== filters.propertyId) return false;
  if (filters.category && expense.category !== filters.category) return false;
  if (filters.costCenterId && expense.cost_center_id !== filters.costCenterId) return false;
  return true;
}

const agingBucketLabels: Record<AgingBucketKey, string> = {
  current: 'غير متأخر',
  days_1_30: '1–30 يوم',
  days_31_60: '31–60 يوم',
  days_61_90: '61–90 يوم',
  days_90_plus: 'أكثر من 90 يوم',
};

const agingBucketOrder: AgingBucketKey[] = ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'];
const receivableInvoiceStatuses: Invoice['status'][] = ['issued', 'partial', 'overdue'];
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function createEmptyAgingBuckets(): Record<AgingBucketKey, AgedReceivablesBucket> {
  return agingBucketOrder.reduce((buckets, key) => {
    buckets[key] = { key, label: agingBucketLabels[key], total: 0, invoiceCount: 0 };
    return buckets;
  }, {} as Record<AgingBucketKey, AgedReceivablesBucket>);
}

function parseDateOnly(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export function calculateDaysOverdue(dueDate: string | null | undefined, asOf: string): number {
  if (!dueDate) return 0;
  const dueTimestamp = parseDateOnly(dueDate);
  const asOfTimestamp = parseDateOnly(asOf);
  if (!Number.isFinite(dueTimestamp) || !Number.isFinite(asOfTimestamp)) return 0;
  return Math.max(0, Math.floor((asOfTimestamp - dueTimestamp) / millisecondsPerDay));
}

export function getAgingBucketKey(dueDate: string | null | undefined, asOf: string): AgingBucketKey {
  if (!dueDate || dueDate > asOf) return 'current';
  const daysOverdue = calculateDaysOverdue(dueDate, asOf);
  if (daysOverdue <= 30) return 'days_1_30';
  if (daysOverdue <= 60) return 'days_31_60';
  if (daysOverdue <= 90) return 'days_61_90';
  return 'days_90_plus';
}

function isReceivableInvoiceStatus(status: Invoice['status']) {
  return receivableInvoiceStatuses.includes(status);
}

export function filterInvoicesForArrearsReport(invoices: InvoiceReportRow[], filters: ArrearsReportFilters) {
  return invoices.filter((invoice) => {
    if (invoice.deleted_at) return false;
    if (!isReceivableInvoiceStatus(invoice.status)) return false;
    if (getInvoiceReportRemainingAmount(invoice) <= 0) return false;
    return matchesInvoiceContext(invoice, filters);
  });
}

export function filterInvoicesForReport(invoices: InvoiceReportRow[], filters: FinancialReportFilters) {
  return invoices.filter((invoice) => {
    // These guards duplicate the Supabase filters on purpose for direct helper
    // callers/tests and as a defensive boundary around manually hydrated rows.
    if (invoice.deleted_at) return false;
    if (!isWithinDateRange(invoice.issue_date, filters)) return false;
    if (hasStatusFilter(filters.status) && invoice.status !== filters.status) return false;
    return matchesInvoiceContext(invoice, filters);
  });
}

export function filterPaymentsForReport(payments: PaymentWithInvoiceContext[], filters: FinancialReportFilters) {
  return payments.filter((payment) => {
    if (payment.deleted_at) return false;
    if (payment.status?.toUpperCase() === 'VOID') return false;
    if (!isWithinDateRange(payment.payment_date, filters)) return false;
    return matchesPaymentContext(payment, filters);
  });
}

export function filterExpensesForReport(expenses: ExpenseReportRow[], filters: ExpenseBreakdownReportFilters) {
  return expenses.filter((expense) => matchesExpenseFilters(expense, filters));
}

type ArrearsContextMaps = {
  tenantsById?: Map<string, PersonContext>;
  propertiesById?: Map<string, PropertyContext>;
  unitsById?: Map<string, UnitContext>;
};

type ArrearsInvoiceRow = InvoiceReportRow & { contracts?: ContractContext | null };
type ArrearsEntityContextFields = Pick<
  OverdueInvoiceReportRow,
  'contractId' | 'tenantId' | 'tenantName' | 'propertyId' | 'propertyTitle' | 'unitId' | 'unitNumber'
>;

function getArrearsEntityContextFields(invoice: ArrearsInvoiceRow, contexts: ArrearsContextMaps = {}): ArrearsEntityContextFields {
  const contract = invoice.contracts ?? null;
  const tenant = contract?.tenant_id ? contexts.tenantsById?.get(contract.tenant_id) : undefined;
  const property = contract?.property_id ? contexts.propertiesById?.get(contract.property_id) : undefined;
  const unit = contract?.unit_id ? contexts.unitsById?.get(contract.unit_id) : undefined;

  return {
    contractId: invoice.contract_id,
    tenantId: contract?.tenant_id ?? null,
    tenantName: tenant?.full_name ?? null,
    propertyId: contract?.property_id ?? null,
    propertyTitle: property?.title ?? null,
    unitId: contract?.unit_id ?? null,
    unitNumber: unit?.unit_number ?? null,
  };
}

function buildOverdueInvoiceRow(invoice: ArrearsInvoiceRow, asOf: string, contexts: ArrearsContextMaps = {}): OverdueInvoiceReportRow {
  return {
    invoiceId: invoice.id,
    shortInvoiceId: invoice.id.slice(0, 8),
    ...getArrearsEntityContextFields(invoice, contexts),
    dueDate: invoice.due_date,
    daysOverdue: calculateDaysOverdue(invoice.due_date, asOf),
    amount: getInvoiceReportGrossAmount(invoice),
    paidAmount: toFinancialNumber(invoice.paid_amount),
    remainingAmount: getInvoiceReportRemainingAmount(invoice),
    status: invoice.status,
  };
}

export function summarizeOverdueInvoicesReport(
  invoices: ArrearsInvoiceRow[],
  filters: ArrearsReportFilters,
  contexts: ArrearsContextMaps = {},
): OverdueInvoicesReport {
  const rows = filterInvoicesForArrearsReport(invoices, filters)
    .filter((invoice) => invoice.due_date <= filters.asOf)
    .map((invoice) => buildOverdueInvoiceRow(invoice, filters.asOf, contexts))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.remainingAmount - a.remainingAmount || a.invoiceId.localeCompare(b.invoiceId));

  return {
    asOf: filters.asOf,
    totalOverdue: sumFinancialValues(rows.map((row) => row.remainingAmount)),
    invoiceCount: rows.length,
    rows,
  };
}

function addToAgingBucket(buckets: Record<AgingBucketKey, AgedReceivablesBucket>, key: AgingBucketKey, amount: number) {
  buckets[key] = {
    ...buckets[key],
    total: toFinancialNumber(buckets[key].total) + toFinancialNumber(amount),
    invoiceCount: buckets[key].invoiceCount + 1,
  };
}

function createAgedReceivablesGroup(invoice: ArrearsInvoiceRow, contexts: ArrearsContextMaps = {}): AgedReceivablesGroupRow {
  return {
    ...getArrearsEntityContextFields(invoice, contexts),
    buckets: createEmptyAgingBuckets(),
    totalOutstanding: 0,
    totalOverdue: 0,
    invoiceCount: 0,
  };
}

export function summarizeAgedReceivablesReport(
  invoices: ArrearsInvoiceRow[],
  filters: ArrearsReportFilters,
  contexts: ArrearsContextMaps = {},
): AgedReceivablesReport {
  const buckets = createEmptyAgingBuckets();
  const groupsByContract = new Map<string, AgedReceivablesGroupRow>();
  const receivableInvoices = filterInvoicesForArrearsReport(invoices, filters);

  for (const invoice of receivableInvoices) {
    const remainingAmount = getInvoiceReportRemainingAmount(invoice);
    const bucketKey = getAgingBucketKey(invoice.due_date, filters.asOf);
    addToAgingBucket(buckets, bucketKey, remainingAmount);

    const group = groupsByContract.get(invoice.contract_id) ?? createAgedReceivablesGroup(invoice, contexts);
    addToAgingBucket(group.buckets, bucketKey, remainingAmount);
    group.totalOutstanding = toFinancialNumber(group.totalOutstanding) + remainingAmount;
    if (bucketKey !== 'current') group.totalOverdue = toFinancialNumber(group.totalOverdue) + remainingAmount;
    group.invoiceCount += 1;
    groupsByContract.set(invoice.contract_id, group);
  }

  const rows = Array.from(groupsByContract.values()).sort((a, b) => {
    const aLabel = a.tenantName ?? a.propertyTitle ?? a.contractId;
    const bLabel = b.tenantName ?? b.propertyTitle ?? b.contractId;
    return aLabel.localeCompare(bLabel, 'ar');
  });

  return {
    asOf: filters.asOf,
    buckets,
    totalOutstanding: sumFinancialValues(agingBucketOrder.map((key) => buckets[key].total)),
    totalOverdue: sumFinancialValues(agingBucketOrder.filter((key) => key !== 'current').map((key) => buckets[key].total)),
    rows,
  };
}

export function summarizeArrearsSummaryReport(invoices: ArrearsInvoiceRow[], filters: ArrearsReportFilters): ArrearsSummaryReport {
  const overdueInvoices = filterInvoicesForArrearsReport(invoices, filters).filter((invoice) => invoice.due_date <= filters.asOf);
  const daysOverdueValues = overdueInvoices.map((invoice) => calculateDaysOverdue(invoice.due_date, filters.asOf));
  const over90Invoices = overdueInvoices.filter((invoice) => calculateDaysOverdue(invoice.due_date, filters.asOf) > 90);

  return {
    asOf: filters.asOf,
    totalOverdue: sumFinancialValues(overdueInvoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    overdueInvoiceCount: overdueInvoices.length,
    over90Amount: sumFinancialValues(over90Invoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    over90InvoiceCount: over90Invoices.length,
    averageDaysOverdue: daysOverdueValues.length > 0
      ? toFinancialNumber(sumFinancialValues(daysOverdueValues) / daysOverdueValues.length)
      : 0,
  };
}

export function summarizeInvoiceTotals(invoices: Array<Pick<InvoiceReportRow, 'amount' | 'paid_amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>>): InvoiceTotalsReport {
  return {
    totalAmount: sumFinancialValues(invoices.map((invoice) => getInvoiceReportGrossAmount(invoice))),
    totalPaid: sumFinancialValues(invoices.map((invoice) => invoice.paid_amount)),
    totalOutstanding: sumFinancialValues(invoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    invoicesCount: invoices.length,
  };
}

export function summarizePaymentTotals(payments: Pick<PaymentReportRow, 'amount'>[]): PaymentTotalsReport {
  return {
    totalPaid: sumFinancialValues(payments.map((payment) => payment.amount)),
    paymentsCount: payments.length,
  };
}

export function summarizeExpenseTotals(expenses: Pick<ExpenseReportRow, 'amount'>[]): ExpenseTotalsReport {
  return {
    totalExpenses: sumFinancialValues(expenses.map((expense) => expense.amount)),
    expensesCount: expenses.length,
  };
}

export function summarizeOutstandingBalance(invoices: Array<Pick<InvoiceReportRow, 'amount' | 'paid_amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>>): OutstandingBalanceReport {
  const outstandingInvoices = invoices.filter((invoice) => getInvoiceReportRemainingAmount(invoice) > 0);
  return {
    totalOutstanding: sumFinancialValues(outstandingInvoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    invoicesCount: outstandingInvoices.length,
  };
}

export function summarizeCollectionReport(params: {
  invoiceTotals: InvoiceTotalsReport;
  paymentTotals: PaymentTotalsReport;
  outstandingBalance: OutstandingBalanceReport;
  expenseTotals: ExpenseTotalsReport;
}): CollectionSummaryReport {
  return {
    invoiced: toFinancialNumber(params.invoiceTotals.totalAmount),
    paid: toFinancialNumber(params.paymentTotals.totalPaid),
    outstanding: toFinancialNumber(params.outstandingBalance.totalOutstanding),
    receiptsCount: params.paymentTotals.paymentsCount,
    invoicesCount: params.invoiceTotals.invoicesCount,
    expensesTotal: toFinancialNumber(params.expenseTotals.totalExpenses),
  };
}

function createEmptyPaymentMethodTotals(): PaymentMethodTotals {
  return {
    cash: 0,
    bank_transfer: 0,
    card: 0,
    check: 0,
    other: 0,
  };
}

function addPaymentAmountByMethod(totals: PaymentMethodTotals, method: Payment['payment_method'], amount: unknown) {
  totals[method] = toFinancialNumber(totals[method]) + toFinancialNumber(amount);
}

export function summarizeDailyCollectionReport(payments: Pick<PaymentReportRow, 'amount' | 'payment_date' | 'payment_method'>[]): DailyCollectionReport {
  const grandMethodTotals = createEmptyPaymentMethodTotals();
  const rowsByDate = new Map<string, DailyCollectionReportRow>();

  for (const payment of payments) {
    const paymentDate = payment.payment_date;
    if (!paymentDate) continue;

    const amount = toFinancialNumber(payment.amount);
    const row = rowsByDate.get(paymentDate) ?? {
      paymentDate,
      totalPaid: 0,
      paymentsCount: 0,
      methodTotals: createEmptyPaymentMethodTotals(),
    };

    row.totalPaid = toFinancialNumber(row.totalPaid) + amount;
    row.paymentsCount += 1;
    addPaymentAmountByMethod(row.methodTotals, payment.payment_method, amount);
    rowsByDate.set(paymentDate, row);

    addPaymentAmountByMethod(grandMethodTotals, payment.payment_method, amount);
  }

  const rows = Array.from(rowsByDate.values()).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  return {
    rows,
    grandTotal: sumFinancialValues(rows.map((row) => row.totalPaid)),
    paymentsCount: rows.reduce((count, row) => count + row.paymentsCount, 0),
    methodTotals: grandMethodTotals,
  };
}

export function summarizeFinancialPeriodSummaryReport(params: {
  invoiceTotals: InvoiceTotalsReport;
  paymentTotals: PaymentTotalsReport;
  outstandingBalance: OutstandingBalanceReport;
  expenseTotals: ExpenseTotalsReport;
}): FinancialPeriodSummaryReport {
  const paid = toFinancialNumber(params.paymentTotals.totalPaid);
  const expenses = toFinancialNumber(params.expenseTotals.totalExpenses);

  return {
    invoiced: toFinancialNumber(params.invoiceTotals.totalAmount),
    paid,
    outstanding: toFinancialNumber(params.outstandingBalance.totalOutstanding),
    expenses,
    netCash: paid - expenses,
    invoicesCount: params.invoiceTotals.invoicesCount,
    paymentsCount: params.paymentTotals.paymentsCount,
    expensesCount: params.expenseTotals.expensesCount,
  };
}


export function summarizeFinancialCashflowReport(params: {
  payments: Pick<PaymentReportRow, 'amount' | 'payment_date'>[];
  expenses: Pick<ExpenseReportRow, 'amount' | 'expense_date'>[];
}): FinancialCashflowReport {
  const rowsByMonth = new Map<string, FinancialCashflowReportRow>();

  for (const payment of params.payments) {
    if (!payment.payment_date) continue;
    const month = payment.payment_date.slice(0, 7);
    const row = rowsByMonth.get(month) ?? { month, revenue: 0, expenses: 0 };
    row.revenue = toFinancialNumber(row.revenue) + toFinancialNumber(payment.amount);
    rowsByMonth.set(month, row);
  }

  for (const expense of params.expenses) {
    if (!expense.expense_date) continue;
    const month = expense.expense_date.slice(0, 7);
    const row = rowsByMonth.get(month) ?? { month, revenue: 0, expenses: 0 };
    row.expenses = toFinancialNumber(row.expenses) + toFinancialNumber(expense.amount);
    rowsByMonth.set(month, row);
  }

  const rows = Array.from(rowsByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  return {
    rows,
    totalRevenue: sumFinancialValues(rows.map((row) => row.revenue)),
    totalExpenses: sumFinancialValues(rows.map((row) => row.expenses)),
  };
}

export function summarizeExpenseBreakdownReport(
  expenses: Pick<ExpenseReportRow, 'amount' | 'category' | 'property_id'>[],
  propertiesById: Map<string, PropertyContext> = new Map(),
  includePropertyBreakdown = true,
): ExpenseBreakdownReport {
  const categoryRowsByKey = new Map<string, ExpenseBreakdownCategoryRow>();
  const propertyRowsById = new Map<string, ExpenseBreakdownPropertyRow>();

  for (const expense of expenses) {
    const amount = toFinancialNumber(expense.amount);
    const category = expense.category?.trim() || 'غير مصنف';
    const categoryRow = categoryRowsByKey.get(category) ?? { category, total: 0, count: 0 };
    categoryRow.total = toFinancialNumber(categoryRow.total) + amount;
    categoryRow.count += 1;
    categoryRowsByKey.set(category, categoryRow);

    if (includePropertyBreakdown) {
      const property = propertiesById.get(expense.property_id);
      const propertyRow = propertyRowsById.get(expense.property_id) ?? {
        propertyId: expense.property_id,
        propertyTitle: property?.title ?? null,
        total: 0,
        count: 0,
      };
      propertyRow.total = toFinancialNumber(propertyRow.total) + amount;
      propertyRow.count += 1;
      propertyRowsById.set(expense.property_id, propertyRow);
    }
  }

  const byCategory = Array.from(categoryRowsByKey.values()).sort((a, b) => a.category.localeCompare(b.category, 'ar'));
  const byProperty = Array.from(propertyRowsById.values()).sort((a, b) => (a.propertyTitle ?? a.propertyId).localeCompare(b.propertyTitle ?? b.propertyId, 'ar'));

  return {
    totalExpenses: sumFinancialValues(expenses.map((expense) => expense.amount)),
    expensesCount: expenses.length,
    byCategory,
    byProperty,
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function loadInvoices(filters: FinancialReportFilters): Promise<InvoiceReportRow[]> {
  let query = supabase
    .from('invoices')
    .select(invoiceReportSelect)
    .is('deleted_at', null)
    .gte('issue_date', filters.dateFrom)
    .lte('issue_date', filters.dateTo);

  if (hasStatusFilter(filters.status)) query = query.eq('status', filters.status);
  if (filters.contractId) query = query.eq('contract_id', filters.contractId);

  const { data, error } = await query.returns<InvoiceReportRow[]>();
  if (error) throw error;
  return filterInvoicesForReport(data ?? [], filters);
}

async function loadArrearsInvoices(filters: ArrearsReportFilters): Promise<InvoiceReportRow[]> {
  let query = supabase
    .from('invoices')
    .select(invoiceReportSelect)
    .is('deleted_at', null)
    .in('status', receivableInvoiceStatuses);

  if (filters.contractId) query = query.eq('contract_id', filters.contractId);

  const { data, error } = await query.returns<InvoiceReportRow[]>();
  if (error) throw error;
  return filterInvoicesForArrearsReport(data ?? [], filters);
}

async function loadPaymentContexts(payments: PaymentReportRow[]): Promise<PaymentWithInvoiceContext[]> {
  if (payments.length === 0) return [];

  // Batched hydration only: one invoice lookup for all payment invoice ids, then
  // one contract lookup for all related contract ids. Do not add per-payment
  // queries here.
  const invoiceIds = uniqueStrings(payments.map((payment) => payment.invoice_id));
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, contract_id, deleted_at')
    .in('id', invoiceIds)
    .is('deleted_at', null)
    .returns<Array<Pick<InvoiceReportRow, 'id' | 'contract_id' | 'deleted_at'>>>();
  if (invoicesError) throw invoicesError;

  const invoiceRows = invoices ?? [];
  const contractIds = uniqueStrings(invoiceRows.map((invoice) => invoice.contract_id));
  const { data: contracts, error: contractsError } = contractIds.length > 0
    ? await supabase
      .from('contracts')
      .select('id, property_id, tenant_id')
      .in('id', contractIds)
      .is('deleted_at', null)
      .returns<ContractContext[]>()
    : { data: [], error: null };
  if (contractsError) throw contractsError;

  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const contractById = new Map((contracts ?? []).map((contract) => [contract.id, contract]));

  return payments.map((payment) => {
    const invoice = payment.invoice_id ? (invoiceById.get(payment.invoice_id) ?? null) : null;
    return {
      ...payment,
      invoice,
      contract: invoice?.contract_id ? contractById.get(invoice.contract_id) ?? null : null,
    };
  });
}

async function loadPayments(filters: FinancialReportFilters): Promise<PaymentWithInvoiceContext[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(paymentReportSelect)
    .is('deleted_at', null)
    .gte('payment_date', filters.dateFrom)
    .lte('payment_date', filters.dateTo)
    .returns<PaymentReportRow[]>();
  if (error) throw error;

  const contexts = await loadPaymentContexts(data ?? []);
  return filterPaymentsForReport(contexts, filters);
}

async function loadExpenses(filters: ExpenseBreakdownReportFilters): Promise<ExpenseReportRow[]> {
  let query = supabase
    .from('expenses')
    .select(expenseReportSelect)
    .is('deleted_at', null)
    .gte('expense_date', filters.dateFrom)
    .lte('expense_date', filters.dateTo);

  if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.costCenterId) query = query.eq('cost_center_id', filters.costCenterId);

  const { data, error } = await query.returns<ExpenseReportRow[]>();
  if (error) throw error;

  return filterExpensesForReport(data ?? [], filters);
}

export async function getInvoiceTotalsReport(filters: FinancialReportFilters): Promise<InvoiceTotalsReport> {
  const invoices = await loadInvoices(filters);
  return summarizeInvoiceTotals(invoices);
}

export async function getPaymentTotalsReport(filters: FinancialReportFilters): Promise<PaymentTotalsReport> {
  const payments = await loadPayments(filters);
  return summarizePaymentTotals(payments);
}

export async function getExpenseTotalsReport(filters: FinancialReportFilters): Promise<ExpenseTotalsReport> {
  const expenses = await loadExpenses(filters);
  return summarizeExpenseTotals(expenses);
}

export async function getOutstandingBalanceReport(filters: FinancialReportFilters): Promise<OutstandingBalanceReport> {
  const invoices = await loadInvoices(filters);
  return summarizeOutstandingBalance(invoices);
}

export async function getCollectionSummaryReport(filters: FinancialReportFilters): Promise<CollectionSummaryReport> {
  const [invoices, payments, expenses] = await Promise.all([
    loadInvoices(filters),
    loadPayments(filters),
    loadExpenses(filters),
  ]);

  return summarizeCollectionReport({
    invoiceTotals: summarizeInvoiceTotals(invoices),
    // Receipts are currently read-only projections of posted payments, so the
    // collection summary uses payment totals as the canonical receipt total.
    paymentTotals: summarizePaymentTotals(payments),
    outstandingBalance: summarizeOutstandingBalance(invoices),
    expenseTotals: summarizeExpenseTotals(expenses),
  });
}

async function loadPropertiesById(propertyIds: string[]): Promise<Map<string, PropertyContext>> {
  if (propertyIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('properties')
    .select('id, title')
    .in('id', propertyIds)
    .is('deleted_at', null)
    .returns<PropertyContext[]>();
  if (error) throw error;

  return new Map((data ?? []).map((property) => [property.id, property]));
}

async function loadPeopleById(tenantIds: string[]): Promise<Map<string, PersonContext>> {
  if (tenantIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('people')
    .select('id, full_name')
    .in('id', tenantIds)
    .is('deleted_at', null)
    .returns<PersonContext[]>();
  if (error) throw error;

  return new Map((data ?? []).map((person) => [person.id, person]));
}

async function loadUnitsById(unitIds: string[]): Promise<Map<string, UnitContext>> {
  if (unitIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('units')
    .select('id, unit_number')
    .in('id', unitIds)
    .is('deleted_at', null)
    .returns<UnitContext[]>();
  if (error) throw error;

  return new Map((data ?? []).map((unit) => [unit.id, unit]));
}

function mapFromSettledContext<T>(result: PromiseSettledResult<Map<string, T>>): Map<string, T> {
  return result.status === 'fulfilled' ? result.value : new Map<string, T>();
}

function getJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getJsonNumber(value: unknown): number {
  return toFinancialNumber(typeof value === 'string' || typeof value === 'number' ? value : 0);
}

function getJsonString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getInvoiceReportGrossAmount(invoice: Pick<InvoiceReportRow, 'amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>): number {
  return toFinancialNumber(invoice.amount) + toFinancialNumber(invoice.tax_amount);
}

function getInvoiceReportRemainingAmount(invoice: Pick<InvoiceReportRow, 'amount' | 'paid_amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>): number {
  return getSafeRemainingAmount(getInvoiceReportGrossAmount(invoice), invoice.paid_amount);
}

export function normalizeCashFlowStatementReport(payload: unknown): CashFlowStatementReport {
  const root = getJsonRecord(payload);
  const period = getJsonRecord(root.period);
  const operating = getJsonRecord(root.operating);
  const investing = getJsonRecord(root.investing);
  const financing = getJsonRecord(root.financing);

  return {
    period: {
      from: getJsonString(period.from),
      to: getJsonString(period.to),
    },
    operating: {
      receipts: getJsonNumber(operating.receipts),
      expenses: getJsonNumber(operating.expenses),
      netOperating: getJsonNumber(operating.net_operating),
    },
    investing: {
      amount: getJsonNumber(investing.amount),
      note: getJsonString(investing.note),
    },
    financing: {
      amount: getJsonNumber(financing.amount),
      note: getJsonString(financing.note),
    },
    netChange: getJsonNumber(root.net_change),
  };
}

export function normalizeVatReturnReport(payload: unknown): VatReturnReport {
  const root = getJsonRecord(payload);
  const period = getJsonRecord(root.period);

  return {
    period: {
      from: getJsonString(period.from),
      to: getJsonString(period.to),
    },
    totalSalesAmount: getJsonNumber(root.total_sales_amount),
    totalTaxAmount: getJsonNumber(root.total_tax_amount),
    invoiceCount: Math.trunc(getJsonNumber(root.invoice_count)),
  };
}

async function loadArrearsContextMaps(invoices: ArrearsInvoiceRow[]): Promise<ArrearsContextMaps> {
  const contracts = invoices.map((invoice) => invoice.contracts).filter((contract): contract is ContractContext => Boolean(contract));
  const [tenantsResult, propertiesResult, unitsResult] = await Promise.allSettled([
    loadPeopleById(uniqueStrings(contracts.map((contract) => contract.tenant_id))),
    loadPropertiesById(uniqueStrings(contracts.map((contract) => contract.property_id))),
    loadUnitsById(uniqueStrings(contracts.map((contract) => contract.unit_id))),
  ]);

  return {
    tenantsById: mapFromSettledContext(tenantsResult),
    propertiesById: mapFromSettledContext(propertiesResult),
    unitsById: mapFromSettledContext(unitsResult),
  };
}

export async function getOverdueInvoicesReport(filters: ArrearsReportFilters): Promise<OverdueInvoicesReport> {
  const invoices = await loadArrearsInvoices(filters);
  const overdueInvoices = invoices.filter((invoice) => invoice.due_date <= filters.asOf);
  const contexts = await loadArrearsContextMaps(overdueInvoices);
  return summarizeOverdueInvoicesReport(overdueInvoices, filters, contexts);
}

export async function getAgedReceivablesReport(filters: ArrearsReportFilters): Promise<AgedReceivablesReport> {
  const invoices = await loadArrearsInvoices(filters);
  const contexts = await loadArrearsContextMaps(invoices);
  return summarizeAgedReceivablesReport(invoices, filters, contexts);
}

export async function getArrearsSummaryReport(filters: ArrearsReportFilters): Promise<ArrearsSummaryReport> {
  const invoices = await loadArrearsInvoices(filters);
  return summarizeArrearsSummaryReport(invoices, filters);
}

export async function getDailyCollectionReport(filters: FinancialReportFilters): Promise<DailyCollectionReport> {
  const payments = await loadPayments(filters);
  return summarizeDailyCollectionReport(payments);
}

export async function getFinancialPeriodSummaryReport(filters: FinancialReportFilters): Promise<FinancialPeriodSummaryReport> {
  const [invoices, payments, expenses] = await Promise.all([
    loadInvoices(filters),
    loadPayments(filters),
    loadExpenses(filters),
  ]);

  return summarizeFinancialPeriodSummaryReport({
    invoiceTotals: summarizeInvoiceTotals(invoices),
    paymentTotals: summarizePaymentTotals(payments),
    outstandingBalance: summarizeOutstandingBalance(invoices),
    expenseTotals: summarizeExpenseTotals(expenses),
  });
}


export async function getFinancialCashflowReport(filters: FinancialReportFilters): Promise<FinancialCashflowReport> {
  const [payments, expenses] = await Promise.all([
    loadPayments(filters),
    loadExpenses(filters),
  ]);

  return summarizeFinancialCashflowReport({ payments, expenses });
}

export async function getCashFlowStatementReport(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>): Promise<CashFlowStatementReport> {
  const { data, error } = await supabase.rpc('rpt_cash_flow', {
    p_from_date: filters.dateFrom,
    p_to_date: filters.dateTo,
  });
  if (error) throw error;
  return normalizeCashFlowStatementReport(data);
}

export async function getVatReturnReport(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>): Promise<VatReturnReport> {
  const { data, error } = await supabase.rpc('rpt_vat_return', {
    p_from_date: filters.dateFrom,
    p_to_date: filters.dateTo,
  });
  if (error) throw error;
  return normalizeVatReturnReport(data);
}

export async function getExpenseBreakdownReport(filters: ExpenseBreakdownReportFilters): Promise<ExpenseBreakdownReport> {
  const expenses = await loadExpenses(filters);
  const includePropertyBreakdown = !filters.propertyId;
  const propertiesById = includePropertyBreakdown
    ? await loadPropertiesById(uniqueStrings(expenses.map((expense) => expense.property_id)))
    : new Map<string, PropertyContext>();

  return summarizeExpenseBreakdownReport(expenses, propertiesById, includePropertyBreakdown);
}
