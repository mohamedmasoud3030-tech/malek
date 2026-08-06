import { documentService } from '@/services/documents/DocumentService';
import {
  toInvoiceDocumentPayload,
  type InvoiceDocumentData,
} from '@/services/documents/documentPayloadAdapters';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';
import type { Contract, Invoice, Person, Property, Unit } from '@/types/domain';

export type InvoiceDocumentContext = {
  settings: DocumentCompanySettings;
  contracts: Contract[];
  tenants: Person[];
  units: Unit[];
  properties: Property[];
};

function invoiceDocumentData(invoice: Invoice, context: InvoiceDocumentContext): InvoiceDocumentData {
  const contract = context.contracts.find((candidate) => candidate.id === invoice.contract_id);
  const tenant = contract ? context.tenants.find((candidate) => candidate.id === contract.tenant_id) : undefined;
  const unit = contract ? context.units.find((candidate) => candidate.id === contract.unit_id) : undefined;
  const property = contract ? context.properties.find((candidate) => candidate.id === contract.property_id) : undefined;

  return {
    // The invoices table has no authoritative invoice number. Do not turn the
    // internal UUID into a client-facing document reference.
    invoiceNumber: '',
    tenantName: tenant?.full_name ?? '—',
    propertyName: property?.title ?? '—',
    unitNumber: unit?.unit_number ?? '—',
    description: invoice.notes?.trim() || 'مطالبة إيجارية مستحقة',
    amount: Number(invoice.amount ?? 0),
    vatAmount: invoice.tax_amount ?? undefined,
    paidAmount: invoice.paid_amount ?? undefined,
    // There is no stored authoritative grand total in this table. The
    // document layer must not recreate one from amount + VAT.
    totalAmount: undefined,
    dueDate: invoice.due_date,
    issueDate: invoice.issue_date,
  };
}

export function printInvoiceDocument(invoice: Invoice, context: InvoiceDocumentContext): Promise<void> {
  const data = invoiceDocumentData(invoice, context);
  return documentService.printDocument('invoice', {
    settings: context.settings,
    payload: toInvoiceDocumentPayload(data),
  });
}

export function exportInvoiceDocument(invoice: Invoice, context: InvoiceDocumentContext): Promise<void> {
  const data = invoiceDocumentData(invoice, context);
  return documentService.downloadDocumentPdf('invoice', {
    settings: context.settings,
    payload: toInvoiceDocumentPayload(data),
  });
}
