import { supabase } from '@/lib/supabase';
import type { Invoice, Payment } from '@/types/domain';
import {
  getSafeRemainingAmount,
  toFinancialNumber,
} from '@/features/financials/financialMath';
import { getInvoiceGrossAmount } from '@/features/financials/invoices/invoiceService';
import { formatReceiptNumber } from '@/features/financials/receipts/receiptService';

export type ContractInvoicePaymentRow = Readonly<{
  id: string;
  invoice_id: string;
  invoice_status: Invoice['status'];
  invoice_due_date: string;
  payment_date: string;
  amount: number;
  payment_method: Payment['payment_method'];
  reference_number: string | null;
  receipt_reference: string;
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
> & Partial<Pick<Invoice, 'tax_amount'>>;
type PaymentRow = Pick<
  Payment,
  | 'id'
  | 'invoice_id'
  | 'amount'
  | 'payment_method'
  | 'payment_date'
  | 'reference_number'
>;

function toPaymentRow(
  payment: PaymentRow,
  invoice: InvoiceRow,
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
    receipt_reference: formatReceiptNumber(payment.id),
  };
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
    .select('id, issue_date, due_date, amount, tax_amount, paid_amount, status, notes')
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
            'id, invoice_id, amount, payment_method, payment_date, reference_number',
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
  const paymentsByInvoiceId = new Map<string, ContractInvoicePaymentRow[]>();
  const payments = (paymentRows ?? []).flatMap((payment) => {
    const invoice = payment.invoice_id ? invoicesById.get(payment.invoice_id) : undefined;
    if (!invoice) {
      return [];
    }

    const row = toPaymentRow(payment, invoice);
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
    payments: paymentsByInvoiceId.get(invoice.id) ?? [],
  }));

  return {
    invoices: contractInvoices,
    payments,
    summary: buildSummary(contractInvoices, payments),
  };
}
