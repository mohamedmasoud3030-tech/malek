import { supabase } from '@/lib/supabase';
import { chunkForInFilter } from '@/lib/paginatedRead';
import type { Contract, Invoice, Payment, Person, Property, Unit } from '@/types/domain';
import { formatReceiptNumber } from '../components/receipt-formatters';

// Keep the public helper on this module for existing services/tests.
export { formatReceiptNumber };

export type ReceiptListParams = { limit?: number };

export type ReceiptRecord = {
  id: string;
  receipt_number: string;
  payment_id: string;
  invoice_id: string | null;
  invoice_reference?: string | null;
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

type ReceiptInvoiceContext = Pick<Invoice, 'id' | 'contract_id' | 'status' | 'reference'>;
type ReceiptContractContext = Pick<Contract, 'id' | 'property_id' | 'unit_id' | 'tenant_id'>;
type ReceiptUnitContext = Pick<Unit, 'id' | 'unit_number'>;
type ReceiptPropertyContext = Pick<Property, 'id' | 'title'>;
type ReceiptTenantContext = Pick<Person, 'id' | 'full_name'>;
type ReceiptAllocationContext = { receipt_id: string; invoice_id: string | null };

const DEFAULT_RECEIPT_LIMIT = 25;

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function toReceiptRecord(
  payment: Payment,
  invoiceIdByReceiptId: Map<string, string>,
  invoiceById: Map<string, ReceiptInvoiceContext>,
  contractById: Map<string, ReceiptContractContext>,
  unitById: Map<string, ReceiptUnitContext>,
  propertyById: Map<string, ReceiptPropertyContext>,
  tenantById: Map<string, ReceiptTenantContext>,
  referenceByReceiptId: Map<string, string> = new Map(),
): ReceiptRecord {
  const receiptId = payment.receipt_id ?? payment.id;
  const invoiceId = payment.invoice_id ?? invoiceIdByReceiptId.get(receiptId) ?? null;
  const invoice = invoiceId ? (invoiceById.get(invoiceId) ?? null) : null;
  const contract = invoice?.contract_id ? contractById.get(invoice.contract_id) ?? null : null;
  const unit = contract?.unit_id ? unitById.get(contract.unit_id) ?? null : null;
  const property = contract?.property_id ? propertyById.get(contract.property_id) ?? null : null;
  const tenant = contract?.tenant_id ? tenantById.get(contract.tenant_id) ?? null : null;

  return {
    id: payment.id,
    // Prefer the server-generated company-scoped reference. The truncated
    // UUID-slice formatter is only a fallback for rows that predate the
    // reference column — never the primary business identifier.
    receipt_number: referenceByReceiptId.get(receiptId) ?? formatReceiptNumber(payment.id),
    payment_id: payment.id,
    invoice_id: invoice?.id ?? invoiceId,
    invoice_reference: invoice?.reference ?? null,
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

  const receiptIds = uniqueStrings(payments.map((payment) => payment.receipt_id ?? payment.id));
  const { data: allocationRows, error: allocationsError } = await supabase
    .from('receipt_allocations')
    .select('receipt_id, invoice_id')
    .in('receipt_id', receiptIds)
    .is('deleted_at', null)
    .returns<ReceiptAllocationContext[]>();
  if (allocationsError) throw allocationsError;

  const allocationInvoiceIdsByReceipt = new Map<string, Set<string>>();
  for (const allocation of allocationRows ?? []) {
    if (!allocation.invoice_id) continue;
    const ids = allocationInvoiceIdsByReceipt.get(allocation.receipt_id) ?? new Set<string>();
    ids.add(allocation.invoice_id);
    allocationInvoiceIdsByReceipt.set(allocation.receipt_id, ids);
  }
  const invoiceIdByReceiptId = new Map(
    [...allocationInvoiceIdsByReceipt.entries()]
      .filter(([, ids]) => ids.size === 1)
      .map(([receiptId, ids]) => [receiptId, [...ids][0]]),
  );

  // Surface the server-generated company-scoped reference from the receipts
  // table so the UI shows a business identifier instead of a raw UUID slice.
  const referenceByReceiptId = new Map<string, string>();
  if (receiptIds.length > 0) {
    const { data: receiptRows, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, reference')
      .in('id', receiptIds)
      .returns<Array<{ id: string; reference: string | null }>>();
    if (receiptsError) throw receiptsError;
    for (const row of (receiptRows ?? []) as Array<{ id: string; reference: string | null }>) {
      if (row.reference) referenceByReceiptId.set(row.id, row.reference);
    }
  }
  const invoiceIds = uniqueStrings([
    ...payments.map((payment) => payment.invoice_id),
    ...invoiceIdByReceiptId.values(),
  ]);

  const fetchInChunks = async <T,>(ids: string[], table: string, columns: string): Promise<T[]> => {
    if (ids.length === 0) return [];
    const results: T[] = [];
    for (const chunk of chunkForInFilter(ids)) {
      let query: any = (supabase.from(table as any) as any)
        .select(columns)
        .in('id', chunk)
        .is('deleted_at', null);
      if (typeof query.returns === 'function') {
        query = query.returns();
      }
      const { data, error } = await query;
      if (error) throw error;
      results.push(...((data as T[]) ?? []));
    }
    return results;
  };

  const invoiceRows = await fetchInChunks<ReceiptInvoiceContext>(invoiceIds, 'invoices', 'id, reference, contract_id, status');
  const contractIds = uniqueStrings(invoiceRows.map((invoice) => invoice.contract_id));
  const contractRows = await fetchInChunks<ReceiptContractContext>(contractIds, 'contracts', 'id, property_id, unit_id, tenant_id');

  const unitIds = uniqueStrings(contractRows.map((contract) => contract.unit_id));
  const propertyIds = uniqueStrings(contractRows.map((contract) => contract.property_id));
  const tenantIds = uniqueStrings(contractRows.map((contract) => contract.tenant_id));

  const [unitsData, propertiesData, tenantsData] = await Promise.all([
    fetchInChunks<ReceiptUnitContext>(unitIds, 'units', 'id, unit_number'),
    fetchInChunks<ReceiptPropertyContext>(propertyIds, 'properties', 'id, title'),
    fetchInChunks<ReceiptTenantContext>(tenantIds, 'people', 'id, full_name'),
  ]);

  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const contractById = new Map(contractRows.map((contract) => [contract.id, contract]));
  const unitById = new Map(unitsData.map((unit) => [unit.id, unit]));
  const propertyById = new Map(propertiesData.map((property) => [property.id, property]));
  const tenantById = new Map(tenantsData.map((tenant) => [tenant.id, tenant]));

  return payments.map((payment) => toReceiptRecord(
    payment,
    invoiceIdByReceiptId,
    invoiceById,
    contractById,
    unitById,
    propertyById,
    tenantById,
    referenceByReceiptId,
  ));
}

export async function listReceipts(params: ReceiptListParams = {}): Promise<ReceiptRecord[]> {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .is('deleted_at', null)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
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

export type ReceiptVoidRequestStatus = 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';

export type ReceiptVoidRequestRecord = {
  id: string;
  company_id: string;
  receipt_id: string;
  reason: string;
  status: ReceiptVoidRequestStatus;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  request_id: string;
  execution_request_id: string | null;
  reversal_batch_id: string | null;
};

export type RequestReceiptVoidPayload = {
  receipt_id: string;
  reason: string;
  request_id: string;
};

export type RequestReceiptVoidResult = {
  success: true;
  idempotent: boolean;
  void_request_id: string;
  request_id: string;
  receipt_id: string;
  status: ReceiptVoidRequestStatus;
  reason: string;
  requested_by: string;
  requested_at: string;
};

export type ApproveReceiptVoidPayload = {
  void_request_id: string;
  request_id: string;
};

export type ApproveReceiptVoidResult = {
  success: true;
  idempotent: boolean;
  request_id: string;
  requested_receipt_id: string;
  payment_id: string;
  receipt_id: string;
  status: 'VOID';
  reason: string;
  journal_reversal_batch_id: string | null;
  journal_reversal_entries: number;
  void_request_id: string;
  void_request_status: 'EXECUTED';
  requested_by: string;
  approved_by: string;
  approval_request_id: string;
};

function isRequestReceiptVoidResult(value: unknown): value is RequestReceiptVoidResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return result.success === true
    && typeof result.idempotent === 'boolean'
    && typeof result.void_request_id === 'string'
    && typeof result.request_id === 'string'
    && typeof result.receipt_id === 'string'
    && ['PENDING', 'EXECUTED', 'REJECTED', 'CANCELLED'].includes(String(result.status))
    && typeof result.reason === 'string'
    && typeof result.requested_by === 'string'
    && typeof result.requested_at === 'string';
}

function isApproveReceiptVoidResult(value: unknown): value is ApproveReceiptVoidResult {
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
    && typeof result.journal_reversal_entries === 'number'
    && typeof result.void_request_id === 'string'
    && result.void_request_status === 'EXECUTED'
    && typeof result.requested_by === 'string'
    && typeof result.approved_by === 'string'
    && typeof result.approval_request_id === 'string';
}

export async function listPendingReceiptVoidRequests(): Promise<ReceiptVoidRequestRecord[]> {
  // The table is introduced by the same WP-01 migration. Cast only at this
  // boundary until generated database types are refreshed from the deployed
  // target; the explicit result contract below remains authoritative.
  const { data, error } = await (supabase as any)
    .from('receipt_void_requests')
    .select('id, company_id, receipt_id, reason, status, requested_by, requested_at, reviewed_by, reviewed_at, request_id, execution_request_id, reversal_batch_id')
    .eq('status', 'PENDING')
    .order('requested_at', { ascending: true })
    .returns();
  if (error) throw error;
  return (data ?? []) as ReceiptVoidRequestRecord[];
}

export async function requestReceiptVoid(payload: RequestReceiptVoidPayload): Promise<RequestReceiptVoidResult> {
  const { data, error } = await supabase.rpc('request_receipt_void_atomic', { payload });
  if (error) throw error;
  if (data == null) throw new Error('request_receipt_void_atomic returned no data');
  if (!isRequestReceiptVoidResult(data)) {
    throw new Error('request_receipt_void_atomic returned an invalid response contract');
  }
  return data;
}

export async function approveReceiptVoid(payload: ApproveReceiptVoidPayload): Promise<ApproveReceiptVoidResult> {
  const { data, error } = await supabase.rpc('approve_receipt_void_atomic', { payload });
  if (error) throw error;
  if (data == null) throw new Error('approve_receipt_void_atomic returned no data');
  if (!isApproveReceiptVoidResult(data)) {
    throw new Error('approve_receipt_void_atomic returned an invalid response contract');
  }
  return data;
}
