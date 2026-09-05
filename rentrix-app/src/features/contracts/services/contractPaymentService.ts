import { supabase } from '@/lib/supabase';
import type { Invoice, Payment } from '@/types/domain';
import {
  getSafeRemainingAmount,
  toFinancialNumber,
} from '@/features/financials/financialMath';
import { getInvoiceGrossAmount } from '@/features/financials/invoices/invoiceService';
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
> & Partial<Pick<Invoice, 'tax_amount'>> & { reference: string | null };
type PaymentRow = Pick<
  Payment,
  | 'id'
  | 'invoice_id'
  | 'amount'
  | 'payment_method'
  | 'payment_date'
  | 'reference_number'
  | 'receipt_id'
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

async function loadReceiptReferences(payments: readonly PaymentRow[]): Promise<Map<string, string>> {
  const receiptIds = Array.from(new Set(payments.map((payment) => payment.receipt_id ?? payment.id)));
  if (receiptIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('receipts')
    .select('id, reference')
    .in('id', receiptIds)
    .returns<Array<{ id: string; reference: string | null }>>();
  if (error) throw error;
  return new Map((data ?? []).flatMap((row) => (row.reference ? [[row.id, row.reference] as const] : [])));
}

function buildSummary(
  invoices: ContractInvoiceRow[],
  payments: ContractInvoicePaymentRow[],
): ContractPaymentsSummary {
  return {
    invoiceCount: invoices.length,
    paymentCount: payments.length,
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
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, reference, issue_date, due_date, amount, tax_amount, paid_amount, status, notes')
    .eq('contract_id', contractId)
    .is('deleted_at', null)
    .order('due_date', { ascending: false })
    .returns<InvoiceRow[]>();
  if (invoicesError) throw invoicesError;

  const invoiceRows = invoices ?? [];
  const invoiceIds = invoiceRows.map((invoice) => invoice.id);
  const { data: paymentRows, error: paymentsError } =
    invoiceIds.length > 0
      ? await supabase
          .from('payments')
          .select(
            'id, invoice_id, amount, payment_method, payment_date, reference_number, receipt_id',
          )
          .in('invoice_id', invoiceIds)
          .is('deleted_at', null)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false })
          .returns<PaymentRow[]>()
      : { data: [], error: null };
  if (paymentsError) throw paymentsError;

  const invoicesById = new Map(
    invoiceRows.map((invoice) => [invoice.id, invoice]),
  );
  const receiptReferenceById = await loadReceiptReferences(paymentRows ?? []);
  const paymentsByInvoiceId = new Map<string, ContractInvoicePaymentRow[]>();
  const payments = (paymentRows ?? []).flatMap((payment) => {
    const invoice = payment.invoice_id ? invoicesById.get(payment.invoice_id) : undefined;
    if (!invoice) {
      return [];
    }

    const row = toPaymentRow(payment, invoice, receiptReferenceById);
    paymentsByInvoiceId.set(payment.invoice_id ?? '', [
      ...(paymentsByInvoiceId.get(payment.invoice_id ?? '') ?? []),
      row,
    ]);
    return [row];
  });

  const contractInvoices = invoiceRows.map((invoice) => ({
    id: invoice.id,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    amount: invoice.amount,
    paid_amount: invoice.paid_amount,
    // Gross-based like every other surfaces: net + VAT − paid. Using the net
    // amount here under-reported taxed invoices in the contract payments tab.
    remaining_amount: getSafeRemainingAmount(
      getInvoiceGrossAmount(invoice),
      invoice.paid_amount,
    ),
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
