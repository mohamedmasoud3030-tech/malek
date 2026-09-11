/**
 * Canonical engine behavior tests.
 *
 * Pins the truthfulness rules of `documentEngine.buildDocument` — the only
 * document-building contract:
 *  - real business references shown, UUID fragments never;
 *  - invoice amounts pass through unchanged (no engine recalculation);
 *  - status wording comes from the registry only.
 */
import { describe, expect, it } from 'vitest';
import { DocumentDataError, documentEngine } from './DocumentEngine';
import type { DocumentCompanySettings } from './companyIdentity';
import { collectDocumentTextChunks } from './DocumentRenderer';
import { getDocumentTemplateEntry, truthfulStatusLabel } from './documentRegistry';

const settings: DocumentCompanySettings = {
  companyName: 'شركة الأفق لإدارة الأملاك',
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: { invoice: 'INV', receipt: 'REC' },
};

describe('canonical buildDocument — reference truthfulness', () => {
  it('renders a real business reference exactly once, in the designated header field', () => {
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { reference: 'INV-2026-0100', amount: 100, description: 'إيجار يوليو', dueDate: '2026-07-31' },
    });
    // The designated header field is `documentNo`; the title must NOT carry
    // the reference too (no duplicated document numbers).
    expect(model.header.documentNo).toBe('INV-2026-0100');
    expect(model.header.title).not.toContain('INV-2026-0100');
    const headerOccurrences = [model.header.title, model.header.documentNo]
      .filter((chunk): chunk is string => Boolean(chunk))
      .join(' ')
      .split('INV-2026-0100').length - 1;
    expect(headerOccurrences).toBe(1);
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

  it('never lets a UUID reach the document number or file name through any reference field', () => {
    const invoiceModel = documentEngine.buildDocument('invoice', {
      settings,
      payload: { reference: 'deadbeef-0000-4000-8000-0000000000aa', amount: 1200, dueDate: '2026-07-31', status: 'UNPAID' },
    });
    expect(invoiceModel.header.documentNo).toBeNull();
    expect(collectDocumentTextChunks(invoiceModel).join(' ')).not.toContain('deadbeef');
    expect(invoiceModel.fileName).not.toContain('deadbeef');

    const contractModel = documentEngine.buildDocument('contract', {
      settings,
      payload: { reference: 'c0ffee00-0000-4000-8000-000000000001', status: 'draft', rentAmount: 1200 },
    });
    expect(contractModel.header.documentNo).toBeNull();
    expect(collectDocumentTextChunks(contractModel).join(' ')).not.toContain('c0ffee00');
  });
});

describe('canonical buildDocument — financial pass-through', () => {
  it('renders every caller-supplied authoritative invoice figure verbatim', () => {
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: {
        amount: 500,
        paidAmount: 125.5,
        vatAmount: 25,
        totalAmount: 525,
        remainingAmount: 399.5,
        description: 'إيجار',
        status: 'PARTIALLY_PAID',
      },
    });
    const flat = model.tables[0].rows.flat().join(' | ');
    expect(flat).toContain('500.000 ر.ع');
    expect(flat).toContain('25.000 ر.ع');
    expect(flat).toContain('125.500 ر.ع');
    expect(flat).toContain('399.500 ر.ع'); // supplied remaining, not derived
    expect(model.tables[0].totals).toEqual(['إجمالي المستحق السداد', '525.000 ر.ع']);
    expect(model.kpis.find((k) => k.label === 'حالة السداد')?.value).toBe('مدفوعة جزئياً');
  });

  it('passes authoritative totals through unchanged even when display arithmetic would disagree', () => {
    // If the engine recomputed anything, total would become 105 (100 + 5)
    // and remaining 88 (105 - 17). It must render the authoritative figures
    // the caller supplied, untouched.
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { amount: 100, vatAmount: 5, paidAmount: 17, totalAmount: 88, remainingAmount: 71, description: 'قسط' },
    });
    const flat = model.tables[0].rows.flat().join(' | ');
    expect(model.tables[0].totals).toEqual(['إجمالي المستحق السداد', '88.000 ر.ع']);
    expect(flat).toContain('71.000 ر.ع');
    expect(flat).not.toContain('105.000 ر.ع');
  });

  it('omits totals/balances the caller did not supply instead of inventing them', () => {
    // VAT exists but no authoritative total: no grand-total row is derived.
    const withVatOnly = documentEngine.buildDocument('invoice', {
      settings,
      payload: { amount: 500, vatAmount: 25, description: 'إيجار' },
    });
    expect(withVatOnly.tables[0].totals == null || withVatOnly.tables[0].totals.length === 0).toBe(true);
    const flatVat = withVatOnly.tables[0].rows.flat().join(' | ');
    expect(flatVat).toContain('500.000 ر.ع');
    expect(flatVat).toContain('25.000 ر.ع');
    expect(collectDocumentTextChunks(withVatOnly).join(' ')).not.toContain('525.000');

    // Payments exist but no authoritative remaining: no balance is derived.
    const paidOnly = documentEngine.buildDocument('invoice', {
      settings,
      payload: { amount: 500, paidAmount: 100, description: 'إيجار' },
    });
    const flatPaid = collectDocumentTextChunks(paidOnly).join(' ');
    expect(flatPaid).toContain('100.000 ر.ع');
    expect(flatPaid).not.toContain('400.000');
    expect(flatPaid).not.toContain('المبلغ المتبقي');
  });

  it('preserves the invoices-table contract: no VAT line ⇒ stored amount is the billed total', () => {
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { amount: 100, description: 'إيجار' },
    });
    expect(model.tables[0].totals).toEqual(['إجمالي المستحق السداد', '100.000 ر.ع']);
  });

  it('passes amount/paid through and omits VAT/remaining rows that the caller did not supply', () => {
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { dueDate: '2026-07-31', amount: 100, paidAmount: 40, status: 'PARTIALLY_PAID' },
    });
    // No authoritative VAT line nor remaining balance was supplied; the
    // missing values are omitted, never invented.
    expect(model.tables[0].totals).toEqual(['إجمالي المستحق السداد', '100.000 ر.ع']);
    const flat = model.tables[0].rows.flat().join(' | ');
    expect(flat).toContain('40.000 ر.ع');
    expect(flat).not.toContain('60.000');
    expect(collectDocumentTextChunks(model).join(' ')).not.toContain('المبلغ المتبقي');
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

  it('owner statement carries the truthful settlement lifecycle label when supplied, and never invents one', () => {
    const base = {
      ownerName: 'أحمد المالكي',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      totalRent: 1500,
      totalExpenses: 50,
      totalCommission: 150,
      netAmount: 1300,
      transactions: [],
    };
    // A CANCELLED settlement must read as cancelled on the printed document —
    // the amounts alone would otherwise present a dead settlement as a live
    // payable (the F5 misrepresentation class, on the document surface).
    const cancelled = documentEngine.buildDocument('owner_statement', {
      settings,
      payload: { ...base, statusLabel: 'كشف تسوية مالك ملغي' },
    });
    const statusKpi = cancelled.kpis.find((kpi) => kpi.label === 'حالة التسوية');
    expect(statusKpi?.value).toBe('كشف تسوية مالك ملغي');
    expect(collectDocumentTextChunks(cancelled).join(' ')).toContain('ملغي');

    // No label supplied → no status KPI at all: the engine never guesses a
    // lifecycle state from the amounts.
    const withoutStatus = documentEngine.buildDocument('owner_statement', {
      settings,
      payload: base,
    });
    expect(withoutStatus.kpis.find((kpi) => kpi.label === 'حالة التسوية')).toBeUndefined();

    // Lock the registry vocabulary the settlement workspace resolves these
    // labels from, so the printed wording cannot silently degrade to raw enum
    // values for any lifecycle state.
    const entry = getDocumentTemplateEntry('owner_settlement');
    expect(truthfulStatusLabel(entry, 'pending')).toContain('بانتظار الاعتماد');
    expect(truthfulStatusLabel(entry, 'approved')).toContain('معتمد للصرف');
    expect(truthfulStatusLabel(entry, 'paid')).toContain('مصروف ومسدد');
    expect(truthfulStatusLabel(entry, 'cancelled')).toContain('ملغي');
  });
});

describe('canonical contract wording', () => {
  it('draft contracts carry their truthful unsigned wording and full tenant context', () => {
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

    expect(canonical.header.title).toContain('مسودة');
    expect(canonical.header.title).toContain('غير موقّع');
    const text = collectDocumentTextChunks(canonical).join(' | ');
    expect(text).toContain('أحمد بن سالم');
    expect(text).toContain('ID-777');
    expect(text).toContain('B-12');
    expect(canonical.footer.signatures.length).toBeGreaterThan(0);
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
