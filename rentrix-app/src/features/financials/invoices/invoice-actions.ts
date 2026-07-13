import type { Invoice } from '@/types/domain';
import { exportInvoiceToPdf } from '@/services/pdfService';

type InvoiceDocumentContext = Parameters<typeof exportInvoiceToPdf>[1];

export function exportInvoiceDocument(invoice: Invoice, context: InvoiceDocumentContext) {
  exportInvoiceToPdf(invoice, context);
}
