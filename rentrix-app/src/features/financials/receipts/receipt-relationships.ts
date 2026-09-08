import type { Payment } from '@/types/domain';
import { toFinancialNumber } from '../financialMath';
import { supabase } from '@/lib/supabase';
import { fetchAllRowsInBatches } from '@/lib/paginatedRead';

export type ReceiptInvoiceAllocation = { id: string; receipt_id: string; invoice_id: string | null; amount: number };

/** Allocations, not the optional payments.invoice_id, are the governed link.
 * A receipt can settle several invoices; never attribute its whole cash amount
 * to each invoice. Historical direct payment links remain a read fallback. */
export async function loadReceiptAllocations(column: 'invoice_id' | 'receipt_id', ids: readonly string[]): Promise<ReceiptInvoiceAllocation[]> {
  const { rows } = await fetchAllRowsInBatches<ReceiptInvoiceAllocation, string>(ids, batch => supabase
    .from('receipt_allocations').select('id, receipt_id, invoice_id, amount')
    .in(column, [...batch]).is('deleted_at', null).order('id', { ascending: true }));
  return rows;
}

export async function loadReceiptReferences(ids: readonly string[]): Promise<Map<string, string>> {
  const { rows } = await fetchAllRowsInBatches<{ id: string; reference: string | null }, string>(ids, batch => supabase
    .from('receipts').select('id, reference').in('id', [...batch]).order('id', { ascending: true }));
  return new Map(rows.flatMap(row => row.reference ? [[row.id, row.reference] as const] : []));
}


/** Per-invoice cash movements with their original payment/receipt identities.
 * Multi-invoice receipts yield allocation amounts, never repeated full cash. */
export async function loadInvoicePayments(invoiceIds: readonly string[]): Promise<Payment[]> {
  const allocations = await loadReceiptAllocations('invoice_id', invoiceIds);
  const readPayments = (column: 'invoice_id' | 'receipt_id', ids: readonly string[]) => fetchAllRowsInBatches<Payment, string>(ids, batch => supabase
    .from('payments').select('*').in(column, [...batch]).is('deleted_at', null)
    .order('payment_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }));
  const direct = await readPayments('invoice_id', invoiceIds);
  const allocated = await readPayments('receipt_id', allocations.map(row => row.receipt_id));
  const payments = [...new Map([...direct.rows, ...allocated.rows].map(row => [row.id, row])).values()];
  payments.sort((a, b) => (b.payment_date ?? '').localeCompare(a.payment_date ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id));
  const invoiceAmountsByReceipt = new Map<string, Map<string, number>>();
  for (const allocation of allocations) {
    if (!allocation.invoice_id) continue;
    const amounts = invoiceAmountsByReceipt.get(allocation.receipt_id) ?? new Map<string, number>();
    amounts.set(allocation.invoice_id, toFinancialNumber((amounts.get(allocation.invoice_id) ?? 0) + toFinancialNumber(allocation.amount)));
    invoiceAmountsByReceipt.set(allocation.receipt_id, amounts);
  }
  return payments.flatMap(payment => {
    const allocatedAmounts = invoiceAmountsByReceipt.get(payment.receipt_id ?? payment.id);
    const invoiceAmounts = allocatedAmounts ?? new Map(payment.invoice_id ? [[payment.invoice_id, payment.amount]] : []);
    return [...invoiceAmounts].map(([invoice_id, amount]) => ({ ...payment, invoice_id, amount }));
  });
}


/** A receipt spanning invoices must never be assigned an arbitrary invoice. */
export function singleInvoiceIdsByReceipt(allocations: readonly Pick<ReceiptInvoiceAllocation, 'receipt_id' | 'invoice_id'>[]): Map<string, string> {
  const grouped = new Map<string, Set<string>>();
  for (const allocation of allocations) {
    if (!allocation.invoice_id) continue;
    const ids = grouped.get(allocation.receipt_id) ?? new Set<string>();
    ids.add(allocation.invoice_id);
    grouped.set(allocation.receipt_id, ids);
  }
  return new Map([...grouped].filter(([, ids]) => ids.size === 1).map(([receiptId, ids]) => [receiptId, [...ids][0]]));
}
