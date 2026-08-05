/**
 * Canonical engine behavior tests.
 *
 * Pins the truthfulness and parity rules of `documentEngine.buildDocument`
 * and the legacy compatibility `build` path:
 *  - real business references shown, UUID fragments never;
 *  - invoice amounts pass through unchanged (no engine recalculation);
 *  - legacy DB-shaped requests and canonical requests produce the same
 *    truthful model for the same underlying data (adapter parity).
 */
import { describe, expect, it } from 'vitest';
import { DocumentDataError, documentEngine } from './DocumentEngine';
import type { DocumentCompanySettings } from './companyIdentity';
import { collectDocumentTextChunks } from './DocumentRenderer';
import type { Contract, Invoice, Person, Property, Unit } from '@/types/domain';

const settings: DocumentCompanySettings = {
  companyName: 'شركة الأفق لإدارة الأملاك',
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: { invoice: 'INV', receipt: 'REC' },
};

const db = {
  settings: { company: { companyName: settings.companyName, defaultCurrency: 'OMR' } },
  contracts: [
    {
      id: 'c0ffee00-0000-4000-8000-000000000001',
      tenant_id: 'tenant-1',
      unit_id: 'unit-1',
      property_id: 'property-1',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      rent_amount: 1200,
      payment_cycle: 'monthly',
      status: 'draft',
      notes: 'شرط خاص',
    } as unknown as Contract,
  ],
  tenants: [{ id: 'tenant-1', full_name: 'أحمد بن سالم', national_id: 'ID-777', phone: '90000000' } as unknown as Person],
  units: [{ id: 'unit-1', property_id: 'property-1', unit_number: 'B-12' } as unknown as Unit],
  properties: [{ id: 'property-1', title: 'برج الياسمين' } as unknown as Property],
};

describe('canonical buildDocument — reference truthfulness', () => {
  it('shows a real business reference when one exists', () => {
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { reference: 'INV-2026-0100', amount: 100, description: 'إيجار يوليو', dueDate: '2026-07-31' },
    });
    expect(model.header.documentNo).toBe('INV-2026-0100');
    expect(model.header.title).toContain('INV-2026-0100');
    expect(model.fileName).toBe('invoice-INV-2026-0100');
  });

  it('never shows a bare UUID as the document number, even if a caller passes one', () => {
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { reference: '9f1c2ab3-4d5e-6f70-8a9b-0c1d2e3f4a5b', amount: 100, dueDate: '2026-07-31' },
    });
    expect(model.header.documentNo).toBeNull();
    expect(model.header.title).not.toContain('9f1c2ab3');
    expect(collectDocumentTextChunks(model).join(' ')).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('omits the document-number line entirely when no reference exists', () => {
    const model = documentEngine.buildDocument('contract', {
      settings,
      payload: { status: 'active', rentAmount: 500, startDate: '2026-01-01' },
    });
    expect(model.header.documentNo).toBeNull();
  });

  it('legacy DB-shaped requests no longer expose shortened UUIDs as document numbers', () => {
    const invoiceModel = documentEngine.build({
      type: 'invoice',
      payload: {
        invoice: {
          id: 'deadbeef-0000-4000-8000-0000000000aa',
          contract_id: db.contracts[0].id,
          issue_date: '2026-07-01',
          due_date: '2026-07-31',
          amount: 1200,
          paid_amount: 0,
          status: 'UNPAID',
          notes: null,
        } as unknown as Invoice,
        db,
      },
    });
    expect(invoiceModel.header.documentNo).toBeNull();
    expect(collectDocumentTextChunks(invoiceModel).join(' ')).not.toContain('deadbeef');
    expect(invoiceModel.fileName).not.toContain('deadbeef');

    const contractModel = documentEngine.build({ type: 'contract', payload: { contract: db.contracts[0], db } });
    expect(contractModel.header.documentNo).toBeNull();
    expect(collectDocumentTextChunks(contractModel).join(' ')).not.toContain('c0ffee00');
  });
});

describe('canonical buildDocument — financial pass-through', () => {
  it('keeps invoice amount/paid/remaining arithmetic untouched and honors explicit totals', () => {
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { amount: 500, paidAmount: 125.5, vatAmount: 25, totalAmount: 525, description: 'إيجار', status: 'PARTIALLY_PAID' },
    });
    const flat = model.tables[0].rows.flat().join(' | ');
    expect(flat).toContain('500.000 ر.ع');
    expect(flat).toContain('25.000 ر.ع');
    expect(flat).toContain('125.500 ر.ع');
    expect(flat).toContain('399.500 ر.ع'); // remaining = total - paid
    expect(model.tables[0].totals).toEqual(['إجمالي المستحق السداد', '525.000 ر.ع']);
    expect(model.kpis.find((k) => k.label === 'حالة السداد')?.value).toBe('مدفوعة جزئياً');
  });

  it('legacy invoice path keeps its original totals (no VAT invention)', () => {
    const model = documentEngine.build({
      type: 'invoice',
      payload: {
        invoice: {
          id: 'inv-x',
          contract_id: db.contracts[0].id,
          issue_date: null,
          due_date: '2026-07-31',
          amount: 100,
          paid_amount: 40,
          tax_amount: 5,
          status: 'PARTIALLY_PAID',
          notes: null,
        } as unknown as Invoice,
        db,
      },
    });
    // Legacy DB payloads never displayed VAT; the canonical model preserves
    // that totals contract exactly (total = amount, remaining = total-paid).
    expect(model.tables[0].totals).toEqual(['إجمالي المستحق السداد', '100.000 ر.ع']);
    expect(model.tables[0].rows.flat().join(' | ')).toContain('60.000 ر.ع');
  });

  it('throws a DocumentDataError (Arabic) for missing required data', () => {
    expect(() => documentEngine.buildDocument('owner_statement', {
      settings,
      payload: { ownerName: '', totalRent: 0, totalExpenses: 0, totalCommission: 0, netAmount: 0, transactions: [] },
    })).toThrow(DocumentDataError);
    expect(() => documentEngine.buildDocument('owner_statement', {
      settings,
      payload: { ownerName: '', totalRent: 0, totalExpenses: 0, totalCommission: 0, netAmount: 0, transactions: [] },
    })).toThrow(/بيانات المستند ناقصة أو غير صالحة/);
  });
});

describe('adapter parity — legacy and canonical paths agree on truth', () => {
  it('contract: legacy DB request vs canonical payload carry the same truthful content', () => {
    const legacy = documentEngine.build({ type: 'contract', payload: { contract: db.contracts[0], db } });
    const canonical = documentEngine.buildDocument('contract', {
      settings,
      payload: {
        status: 'draft',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        rentAmount: 1200,
        paymentCycle: 'monthly',
        notes: 'شرط خاص',
        tenantName: 'أحمد بن سالم',
        tenantNationalId: 'ID-777',
        tenantPhone: '90000000',
        propertyTitle: 'برج الياسمين',
        unitNumber: 'B-12',
      },
    });

    expect(legacy.header.title).toBe(canonical.header.title);
    expect(legacy.header.title).toContain('مسودة');
    expect(legacy.header.title).toContain('غير موقّع');
    expect(legacy.tables[0].rows).toEqual(canonical.tables[0].rows);
    expect(legacy.kpis).toEqual(canonical.kpis);
    expect(legacy.footer.signatures).toEqual(canonical.footer.signatures);
  });

  it('every canonical model footer carries registry-owned signature roles (no approval claims)', () => {
    const model = documentEngine.buildDocument('invoice', { settings, payload: { amount: 1, description: 'x' } });
    expect(model.footer.signatures).toEqual(['accountant', 'general_manager']);
    expect(model.footer.companyStampLabel).toBeNull();
    expect(collectDocumentTextChunks(model).join(' ')).not.toMatch(/معتمد آلياً|موقّع تلقائياً/);
  });

  it('draft contract wording survives in the rendered text chunks', () => {
    const model = documentEngine.buildDocument('contract', { settings, payload: { status: 'draft', rentAmount: 10 } });
    const chunks = collectDocumentTextChunks(model).join(' ');
    expect(chunks).toContain('مسودة');
    expect(chunks).toContain('غير موقّع');
    expect(chunks).not.toContain('ساري المفعول');
  });
});
