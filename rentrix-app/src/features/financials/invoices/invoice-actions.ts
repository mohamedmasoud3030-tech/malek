import { DocumentTemplates, type DocumentSettings, type InvoiceDocumentData } from '@/services/documents/DocumentTemplates';
import type { Contract, Invoice, Person, Property, Unit } from '@/types/domain';

type InvoiceDocumentContext = {
  settings: {
    general?: {
      company?: {
        name?: string | null;
        legalName?: string | null;
        taxNumber?: string | null;
        registrationNumber?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
      };
    };
    operational?: { currency?: string | null };
  };
  contracts: Contract[];
  tenants: Person[];
  units: Unit[];
  properties: Property[];
};

function documentSettingsFromContext(context: InvoiceDocumentContext): DocumentSettings {
  const company = context.settings.general?.company ?? {};
  return {
    company: {
      name: company.name ?? '',
      legalName: company.legalName ?? undefined,
      taxNumber: company.taxNumber ?? undefined,
      registrationNumber: company.registrationNumber ?? undefined,
      phone: company.phone ?? undefined,
      email: company.email ?? undefined,
      address: company.address ?? undefined,
    },
    currency: context.settings.operational?.currency ?? '',
  };
}

function invoiceDocumentData(invoice: Invoice, context: InvoiceDocumentContext): InvoiceDocumentData {
  const contract = context.contracts.find((candidate) => candidate.id === invoice.contract_id);
  const tenant = contract ? context.tenants.find((candidate) => candidate.id === contract.tenant_id) : undefined;
  const unit = contract ? context.units.find((candidate) => candidate.id === contract.unit_id) : undefined;
  const property = contract ? context.properties.find((candidate) => candidate.id === contract.property_id) : undefined;
  const baseAmount = Number(invoice.amount ?? 0);
  const vatAmount = Number((invoice as { tax_amount?: number | null }).tax_amount ?? 0);

  return {
    invoiceNumber: invoice.id.slice(0, 8),
    tenantName: tenant?.full_name ?? '—',
    propertyName: property?.title ?? '—',
    unitNumber: unit?.unit_number ?? '—',
    description: invoice.notes?.trim() || 'مطالبة إيجارية مستحقة',
    amount: baseAmount,
    vatAmount,
    totalAmount: baseAmount + vatAmount,
    dueDate: invoice.due_date,
    issueDate: invoice.issue_date,
  };
}

export function printInvoiceDocument(invoice: Invoice, context: InvoiceDocumentContext): Promise<void> {
  return DocumentTemplates.printInvoiceDocument(invoiceDocumentData(invoice, context), documentSettingsFromContext(context));
}

export function exportInvoiceDocument(invoice: Invoice, context: InvoiceDocumentContext): Promise<void> {
  return DocumentTemplates.downloadInvoicePdf(invoiceDocumentData(invoice, context), documentSettingsFromContext(context));
}
