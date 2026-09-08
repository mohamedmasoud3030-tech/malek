/** Pure invoice read model. No database/client dependency and no posting authority.
 * `amount` is net; VAT is added once; posted credits reduce debt; overpayment never creates negative arrears.
 * Missing tax remains supported for historical/un-taxed projections.
 */
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';

export type InvoiceSummary = { totalAmount: number; totalTax: number; totalPaid: number; totalRemaining: number; count: number };

export type InvoiceRemainingInput = InvoiceGrossInput & { paid_amount: number | null | undefined; credited_amount?: number | null };

export function getInvoiceRemainingAmount(invoice: InvoiceRemainingInput): number {
  // Persisted invoice fields are OMR numeric(18,3). Match server collect RPC:
  // gross - actual cash allocations - posted credits (credits are not cash).
  return Number(getSafeRemainingAmount(
    getInvoiceGrossAmount(invoice),
    toFinancialNumber(invoice.paid_amount) + toFinancialNumber(invoice.credited_amount),
  ).toFixed(3));
}

export type InvoiceGrossInput = { amount: number | null | undefined; tax_amount?: number | null };

export function getInvoiceGrossAmount(invoice: InvoiceGrossInput): number {
  return toFinancialNumber(invoice.amount) + toFinancialNumber(invoice.tax_amount);
}

export function summarizeInvoices(invoices: readonly InvoiceRemainingInput[]): InvoiceSummary {
  return invoices.reduce(
    (summary, invoice) => {
      const grossAmount = getInvoiceGrossAmount(invoice);
      summary.totalAmount += grossAmount;
      summary.totalTax += toFinancialNumber(invoice.tax_amount);
      summary.totalPaid += toFinancialNumber(invoice.paid_amount);
      summary.totalRemaining += getInvoiceRemainingAmount(invoice);
      summary.count += 1;
      return summary;
    },
    { totalAmount: 0, totalTax: 0, totalPaid: 0, totalRemaining: 0, count: 0 },
  );
}

