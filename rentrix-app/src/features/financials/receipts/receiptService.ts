import { supabase } from '@/lib/supabase';
import type { Contract, Invoice, Payment, Person, Property, Unit } from '@/types/domain';

export type ReceiptListParams = { limit?: number };

export type ReceiptRecord = {
  id: string;
  receipt_number: string;
  payment_id: string;
  invoice_id: string | null;
  invoice_status: Invoice['status'] | null;
  contract_id: string | null;
  payment_date: string;
  amount: number;
  payment_method: Payment['payment_method'];
  reference_number: string | null;
  created_at: string;
  status: 'posted' | 'void';
  tenant_name: string | null;
  unit_number: string | null;
  property_title: string | null;
};

type ReceiptInvoiceContext = Pick<Invoice, 'id' | 'contract_id' | 'status'>;
type ReceiptContractContext = Pick<Contract, 'id' | 'property_id' | 'unit_id' | 'tenant_id'>;
type ReceiptUnitContext = Pick<Unit, 'id' | 'unit_number'>;
type ReceiptPropertyContext = Pick<Property, 'id' | 'title'>;
type ReceiptTenantContext = Pick<Person, 'id' | 'full_name'>;

const DEFAULT_RECEIPT_LIMIT = 25;

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function formatReceiptNumber(paymentId: string) {
  return `REC-${paymentId.slice(0, 8)}`;
}

function toReceiptRecord(
  payment: Payment,
  invoiceById: Map<string, ReceiptInvoiceContext>,
  contractById: Map<string, ReceiptContractContext>,
  unitById: Map<string, ReceiptUnitContext>,
  propertyById: Map<string, ReceiptPropertyContext>,
  tenantById: Map<string, ReceiptTenantContext>,
): ReceiptRecord {
  const invoice = payment.invoice_id ? (invoiceById.get(payment.invoice_id) ?? null) : null;
  const contract = invoice?.contract_id ? contractById.get(invoice.contract_id) ?? null : null;
  const unit = contract?.unit_id ? unitById.get(contract.unit_id) ?? null : null;
  const property = contract?.property_id ? propertyById.get(contract.property_id) ?? null : null;
  const tenant = contract?.tenant_id ? tenantById.get(contract.tenant_id) ?? null : null;

  return {
    id: payment.id,
    receipt_number: formatReceiptNumber(payment.id),
    payment_id: payment.id,
    invoice_id: payment.invoice_id ?? null,
    invoice_status: invoice?.status ?? null,
    contract_id: invoice?.contract_id ?? null,
    payment_date: payment.payment_date ?? '',
    amount: payment.amount ?? 0,
    payment_method: payment.payment_method ?? '',
    reference_number: payment.reference_number,
    created_at: payment.created_at,
    status: payment.status === 'VOID' ? 'void' : 'posted',
    tenant_name: tenant?.full_name ?? null,
    unit_number: unit?.unit_number ?? null,
    property_title: property?.title ?? null,
  };
}

async function loadReceiptRecords(payments: Payment[]): Promise<ReceiptRecord[]> {
  if (payments.length === 0) return [];

  const invoiceIds = uniqueStrings(payments.map((payment) => payment.invoice_id));
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, contract_id, status')
    .in('id', invoiceIds)
    .is('deleted_at', null)
    .returns<ReceiptInvoiceContext[]>();
  if (invoicesError) throw invoicesError;

  const invoiceRows = invoices ?? [];
  const contractIds = uniqueStrings(invoiceRows.map((invoice) => invoice.contract_id));
  const { data: contracts, error: contractsError } = contractIds.length > 0
    ? await supabase
      .from('contracts')
      .select('id, property_id, unit_id, tenant_id')
      .in('id', contractIds)
      .is('deleted_at', null)
      .returns<ReceiptContractContext[]>()
    : { data: [], error: null };
  if (contractsError) throw contractsError;

  const contractRows = contracts ?? [];
  const unitIds = uniqueStrings(contractRows.map((contract) => contract.unit_id));
  const propertyIds = uniqueStrings(contractRows.map((contract) => contract.property_id));
  const tenantIds = uniqueStrings(contractRows.map((contract) => contract.tenant_id));

  const [unitsResult, propertiesResult, tenantsResult] = await Promise.all([
    unitIds.length > 0
      ? supabase.from('units').select('id, unit_number').in('id', unitIds).is('deleted_at', null).returns<ReceiptUnitContext[]>()
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0
      ? supabase.from('properties').select('id, title').in('id', propertyIds).is('deleted_at', null).returns<ReceiptPropertyContext[]>()
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length > 0
      ? supabase.from('people').select('id, full_name').in('id', tenantIds).is('deleted_at', null).returns<ReceiptTenantContext[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (unitsResult.error) throw unitsResult.error;
  if (propertiesResult.error) throw propertiesResult.error;
  if (tenantsResult.error) throw tenantsResult.error;

  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const contractById = new Map(contractRows.map((contract) => [contract.id, contract]));
  const unitById = new Map((unitsResult.data ?? []).map((unit) => [unit.id, unit]));
  const propertyById = new Map((propertiesResult.data ?? []).map((property) => [property.id, property]));
  const tenantById = new Map((tenantsResult.data ?? []).map((tenant) => [tenant.id, tenant]));

  return payments.map((payment) => toReceiptRecord(payment, invoiceById, contractById, unitById, propertyById, tenantById));
}

export async function listReceipts(params: ReceiptListParams = {}): Promise<ReceiptRecord[]> {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .is('deleted_at', null)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(params.limit ?? DEFAULT_RECEIPT_LIMIT)
    .returns<Payment[]>();
  if (error) throw error;
  return loadReceiptRecords(payments ?? []);
}

export async function getReceiptDetail(receiptOrPaymentId: string): Promise<ReceiptRecord> {
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', receiptOrPaymentId)
    .is('deleted_at', null)
    .single()
    .returns<Payment>();
  if (error || !payment) throw error ?? new Error('Receipt not found');
  const [receipt] = await loadReceiptRecords([payment]);
  if (!receipt) throw new Error('Receipt not found');
  return receipt;
}

export type VoidReceiptPayload = {
  receipt_id: string;
  reason: string;
  request_id: string;
};

export type VoidReceiptResult = {
  success: boolean;
  idempotent: boolean;
  request_id: string;
  requested_receipt_id: string;
  payment_id: string;
  receipt_id: string;
  status: 'VOID';
  reason: string;
  journal_reversal_batch_id: string | null;
  journal_reversal_entries: number;
};

function isVoidReceiptResult(value: unknown): value is VoidReceiptResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return result.success === true
    && typeof result.idempotent === 'boolean'
    && typeof result.request_id === 'string'
    && typeof result.requested_receipt_id === 'string'
    && typeof result.payment_id === 'string'
    && typeof result.receipt_id === 'string'
    && result.status === 'VOID'
    && typeof result.reason === 'string'
    && (result.journal_reversal_batch_id === null || typeof result.journal_reversal_batch_id === 'string')
    && typeof result.journal_reversal_entries === 'number';
}

export async function voidReceipt(payload: VoidReceiptPayload): Promise<VoidReceiptResult> {
  const { data, error } = await supabase.rpc('void_receipt_atomic', { payload });
  if (error) throw error;
  if (!isVoidReceiptResult(data)) throw new Error('void_receipt_atomic returned an invalid response contract');
  return data;
}
