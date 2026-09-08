import { fetchAllRows } from '@/lib/paginatedRead';
import { getInvoiceGrossAmount, getInvoiceRemainingAmount } from '@/features/financials/invoices/invoice-amounts';
import { supabase } from '@/lib/supabase';
import type { Invoice, Payment } from '@/types/domain';
import {
  toFinancialNumber,
} from '@/features/financials/financialMath';

import { loadInvoicePayments, loadReceiptReferences } from '@/features/financials/receipts/receipt-relationships';
import { formatReceiptNumber } from '@/features/financials/components/receipt-formatters';

export type ContractInvoicePaymentRow = Readonly<{
  id: string;
  invoice_id: string;
  invoice_status: Invoice['status'];
  invoice_due_date: string;
  payment_date: string;
  amount: number;
  payment_method: Payment['payment_method'];
  reference_number: string | null;
  /** Server-generated company-scoped receipt reference (REC-…), never a fabricated id. */
  receipt_reference: string;
  invoice_reference: string | null;
}>;

export type ContractInvoiceRow = Readonly<{
  id: string;
  issue_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: Invoice['status'];
  notes: string | null;
  reference: string | null;
  payments: ContractInvoicePaymentRow[];
}>;

export type ContractPaymentsSummary = Readonly<{
  invoiceCount: number;
  paymentCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalRemaining: number;
}>;

export type ContractPaymentsSnapshot = Readonly<{
  invoices: ContractInvoiceRow[];
  payments: ContractInvoicePaymentRow[];
  summary: ContractPaymentsSummary;
}>;

type InvoiceRow = Pick<
  Invoice,
  | 'id'
  | 'issue_date'
  | 'due_date'
  | 'amount'
  | 'paid_amount'
  | 'status'
  | 'notes'
> & Partial<Pick<Invoice, 'tax_amount' | 'credited_amount'>> & { reference: string | null };
type PaymentRow = Pick<
  Payment,
  | 'id'
  | 'invoice_id'
  | 'amount'
  | 'payment_method'
  | 'payment_date'
  | 'reference_number'
  | 'receipt_id'
  | 'created_at'
>;

function toPaymentRow(
  payment: PaymentRow,
  invoice: InvoiceRow,
  receiptReferenceById: ReadonlyMap<string, string>,
): ContractInvoicePaymentRow {
  return {
    id: payment.id,
    invoice_id: payment.invoice_id ?? invoice.id,
    invoice_status: invoice.status,
    invoice_due_date: invoice.due_date,
    payment_date: payment.payment_date ?? '',
    amount: payment.amount ?? 0,
    payment_method: payment.payment_method ?? '',
    reference_number: payment.reference_number,
    // Same identity rule as the receipts register: the receipts.reference
    // business number, else the honest "no commercial reference" label.
    receipt_reference: receiptReferenceById.get(payment.receipt_id ?? payment.id) ?? formatReceiptNumber(payment.id),
    invoice_reference: invoice.reference,
  };
}

function buildSummary(
  invoices: ContractInvoiceRow[],
  payments: ContractInvoicePaymentRow[],
): ContractPaymentsSummary {
  return {
    invoiceCount: invoices.length,
    paymentCount: new Set(payments.map(payment => payment.id)).size,
    totalInvoiced: invoices.reduce(
      (total, invoice) => total + toFinancialNumber(invoice.amount),
      0,
    ),
    totalPaid: invoices.reduce(
      (total, invoice) => total + toFinancialNumber(invoice.paid_amount),
      0,
    ),
    totalRemaining: invoices.reduce(
      (total, invoice) => total + toFinancialNumber(invoice.remaining_amount),
      0,
    ),
  };
}

export async function getContractPaymentsSnapshot(
  contractId: string,
): Promise<ContractPaymentsSnapshot> {
  const { rows: invoiceRows } = await fetchAllRows<InvoiceRow>(() => supabase
    .from('invoices')
    .select('id, reference, issue_date, due_date, amount, tax_amount, credited_amount, paid_amount, status, notes')
    .eq('contract_id', contractId)
    .is('deleted_at', null)
    .order('due_date', { ascending: false })
    .order('id', { ascending: false }));
  const invoiceIds = invoiceRows.map((invoice) => invoice.id);
  const paymentRows = await loadInvoicePayments(invoiceIds);

  const invoicesById = new Map(
    invoiceRows.map((invoice) => [invoice.id, invoice]),
  );
  const receiptReferenceById = await loadReceiptReferences(paymentRows.map(row => row.receipt_id ?? row.id));
  const paymentsByInvoiceId = new Map<string, ContractInvoicePaymentRow[]>();
  const payments = paymentRows.flatMap((payment) => {
    const invoice = payment.invoice_id ? invoicesById.get(payment.invoice_id) : undefined;
    if (!invoice) return [];
    const row = toPaymentRow(payment, invoice, receiptReferenceById);
    const bucket = paymentsByInvoiceId.get(invoice.id) ?? [];
    bucket.push(row);
    paymentsByInvoiceId.set(invoice.id, bucket);
    return [row];
  });

  const contractInvoices = invoiceRows.map((invoice) => ({
    id: invoice.id,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    amount: getInvoiceGrossAmount(invoice),
    paid_amount: invoice.paid_amount,
    // Gross-based like every other surfaces: net + VAT − paid. Using the net
    // amount here under-reported taxed invoices in the contract payments tab.
    remaining_amount: getInvoiceRemainingAmount(invoice),
    status: invoice.status,
    notes: invoice.notes,
    reference: invoice.reference,
    payments: paymentsByInvoiceId.get(invoice.id) ?? [],
  }));

  return {
    invoices: contractInvoices,
    payments,
    summary: buildSummary(contractInvoices, payments),
  };
}
