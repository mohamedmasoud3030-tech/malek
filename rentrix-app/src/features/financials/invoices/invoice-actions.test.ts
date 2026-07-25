import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportInvoiceDocument, printInvoiceDocument } from './invoice-actions';
import type { Contract, Invoice, Person, Property, Unit } from '@/types/domain';

vi.mock('@/services/documents/DocumentTemplates', () => ({
  DocumentTemplates: {
    printInvoiceDocument: vi.fn(async () => undefined),
    downloadInvoicePdf: vi.fn(async () => undefined),
  },
}));

const { DocumentTemplates } = await import('@/services/documents/DocumentTemplates');

const invoice = {
  id: 'invoice-12345678',
  contract_id: 'contract-1',
  issue_date: '2026-07-01',
  due_date: '2026-07-31',
  amount: 100,
  paid_amount: 0,
  tax_amount: 5,
  notes: 'إيجار يوليو',
} as Invoice;

const contract = { id: 'contract-1', tenant_id: 'tenant-1', unit_id: 'unit-1', property_id: 'property-1' } as Contract;
const tenant = { id: 'tenant-1', full_name: 'أحمد علي' } as Person;
const unit = { id: 'unit-1', property_id: 'property-1', unit_number: 'A-1' } as Unit;
const property = { id: 'property-1', title: 'برج صحار' } as Property;

const context = {
  settings: {
    general: { company: { name: 'Rentrix LLC', phone: '+968', address: 'Sohar' } },
    operational: { currency: 'OMR' },
  },
  contracts: [contract],
  tenants: [tenant],
  units: [unit],
  properties: [property],
};

describe('invoice document actions', () => {
  beforeEach(() => {
    vi.mocked(DocumentTemplates.printInvoiceDocument).mockClear();
    vi.mocked(DocumentTemplates.downloadInvoicePdf).mockClear();
  });

  it('prints a scoped invoice document from loaded invoice context', async () => {
    await printInvoiceDocument(invoice, context);

    expect(DocumentTemplates.printInvoiceDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'invoice-',
        tenantName: 'أحمد علي',
        propertyName: 'برج صحار',
        unitNumber: 'A-1',
        description: 'إيجار يوليو',
        amount: 100,
        vatAmount: 5,
        totalAmount: 105,
      }),
      expect.objectContaining({ company: expect.objectContaining({ name: 'Rentrix LLC' }), currency: 'OMR' }),
    );
    expect(DocumentTemplates.downloadInvoicePdf).not.toHaveBeenCalled();
  });

  it('downloads the same invoice as PDF without triggering print', async () => {
    await exportInvoiceDocument(invoice, context);

    expect(DocumentTemplates.downloadInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({ tenantName: 'أحمد علي', totalAmount: 105 }),
      expect.objectContaining({ currency: 'OMR' }),
    );
    expect(DocumentTemplates.printInvoiceDocument).not.toHaveBeenCalled();
  });
});
