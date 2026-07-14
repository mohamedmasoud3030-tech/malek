import type { Contract, Expense, Invoice, Payment, Person, Property, Unit } from '@/types/domain';
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';

// Shared row/context shapes for the operational collection and arrears report
// modules. These stay intentionally narrow (Pick/Partial) so loaders only
// request the columns each report actually consumes.

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

export type ContractContext = Pick<Contract, 'id' | 'property_id' | 'tenant_id'> & { unit_id?: Contract['unit_id'] };

export type InvoiceReportRow = Pick<Invoice, 'id' | 'contract_id' | 'issue_date' | 'due_date' | 'amount' | 'paid_amount' | 'status' | 'deleted_at'> & Partial<Pick<Invoice, 'tax_amount'>> & {
  contracts?: ContractContext | null;
};

export type PaymentReportRow = Pick<Payment, 'id' | 'invoice_id' | 'amount' | 'payment_date' | 'payment_method' | 'status' | 'deleted_at'>;

export type ExpenseReportRow = Pick<Expense, 'id' | 'property_id' | 'category' | 'amount' | 'expense_date' | 'cost_center_id' | 'deleted_at'>;

export type PropertyContext = Pick<Property, 'id' | 'title'>;
export type PersonContext = Pick<Person, 'id' | 'full_name'>;
export type UnitContext = Pick<Unit, 'id' | 'unit_number'>;

export type PaymentWithInvoiceContext = PaymentReportRow & {
  invoice: Pick<InvoiceReportRow, 'id' | 'contract_id'> | null;
  contract: ContractContext | null;
};

export function hasStatusFilter(status: FinancialReportFilters['status']): status is Invoice['status'] {
  return Boolean(status && status !== 'all');
}

export function isWithinDateRange(value: string | null | undefined, filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) {
  if (!value) return false;
  return value >= filters.dateFrom && value <= filters.dateTo;
}

export function matchesInvoiceContext(
  invoice: Pick<InvoiceReportRow, 'contract_id' | 'contracts'>,
  filters: Pick<FinancialReportFilters, 'propertyId' | 'tenantId' | 'contractId'>,
) {
  if (filters.contractId && invoice.contract_id !== filters.contractId) return false;
  if (filters.propertyId && invoice.contracts?.property_id !== filters.propertyId) return false;
  if (filters.tenantId && invoice.contracts?.tenant_id !== filters.tenantId) return false;
  return true;
}

export function matchesPaymentContext(payment: PaymentWithInvoiceContext, filters: FinancialReportFilters) {
  if (filters.contractId && payment.invoice?.contract_id !== filters.contractId) return false;
  if (filters.propertyId && payment.contract?.property_id !== filters.propertyId) return false;
  if (filters.tenantId && payment.contract?.tenant_id !== filters.tenantId) return false;
  return true;
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function getInvoiceReportGrossAmount(invoice: Pick<InvoiceReportRow, 'amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>): number {
  return toFinancialNumber(invoice.amount) + toFinancialNumber(invoice.tax_amount);
}

export function getInvoiceReportRemainingAmount(invoice: Pick<InvoiceReportRow, 'amount' | 'paid_amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>): number {
  return getSafeRemainingAmount(getInvoiceReportGrossAmount(invoice), invoice.paid_amount);
}

type SupabaseClient = typeof import('@/lib/supabase').supabase;

export async function loadPropertiesById(
  supabase: SupabaseClient,
  propertyIds: string[],
): Promise<Map<string, PropertyContext>> {
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

export async function loadPeopleById(
  supabase: SupabaseClient,
  tenantIds: string[],
): Promise<Map<string, PersonContext>> {
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

export async function loadUnitsById(
  supabase: SupabaseClient,
  unitIds: string[],
): Promise<Map<string, UnitContext>> {
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

export function mapFromSettledContext<T>(result: PromiseSettledResult<Map<string, T>>): Map<string, T> {
  return result.status === 'fulfilled' ? result.value : new Map<string, T>();
}
