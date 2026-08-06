import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportInvoiceDocument, printInvoiceDocument } from './invoice-actions';
import type { Contract, Invoice, Person, Property, Unit } from '@/types/domain';

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn(async () => undefined),
    downloadDocumentPdf: vi.fn(async () => undefined),
  },
}));

const { documentService } = await import('@/services/documents/DocumentService');

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
const settings = {
  companyName: 'Rentrix LLC',
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: {},
};

const context = {
  settings,
  contracts: [contract],
  tenants: [tenant],
  units: [unit],
  properties: [property],
};

describe('invoice document actions', () => {
  beforeEach(() => {
    vi.mocked(documentService.printDocument).mockClear();
    vi.mocked(documentService.downloadDocumentPdf).mockClear();
  });

  it('prints a scoped invoice through the canonical typed service without inventing a total', async () => {
    await printInvoiceDocument(invoice, context);

    expect(documentService.printDocument).toHaveBeenCalledWith('invoice', {
      settings,
      payload: expect.objectContaining({
        reference: null,
        tenantName: 'أحمد علي',
        propertyTitle: 'برج صحار',
        unitNumber: 'A-1',
        description: 'إيجار يوليو',
        amount: 100,
        vatAmount: 5,
        paidAmount: 0,
        totalAmount: null,
      }),
    });
    expect(documentService.downloadDocumentPdf).not.toHaveBeenCalled();
  });

  it('downloads the same invoice as PDF without triggering print', async () => {
    await exportInvoiceDocument(invoice, context);

    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('invoice', {
      settings,
      payload: expect.objectContaining({ tenantName: 'أحمد علي', totalAmount: null }),
    });
    expect(documentService.printDocument).not.toHaveBeenCalled();
  });
});
