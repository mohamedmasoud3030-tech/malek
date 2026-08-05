/**
 * Template-registry contract tests.
 *
 * The registry is the single declaration point for what the platform can
 * print/export and under which rules. These tests pin completeness of every
 * entry, the registry↔engine parity (one canonical builder per entry, no
 * missing/extra builders), safe deterministic filenames, and truthful
 * status-label lookup.
 */
import { describe, expect, it } from 'vitest';
import { documentEngine } from './DocumentEngine';
import type { DocumentCompanySettings } from './companyIdentity';
import type { CanonicalDocumentPayloadMap, DocumentTypeId } from './documentPayloads';
import {
  buildDocumentFileName,
  documentTemplateRegistry,
  getDocumentTemplateEntry,
  listDocumentTemplateEntries,
  MAX_DOCUMENT_PDF_PAGES,
  requireDocumentTemplateEntry,
  sanitizeDocumentFileName,
  truthfulStatusLabel,
} from './documentRegistry';
import { listDocumentCapabilities } from './DocumentService';

const settings: DocumentCompanySettings = {
  companyName: 'شركة الاختبار العقارية',
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: {},
};

const minimalPayloads: CanonicalDocumentPayloadMap = {
  contract: { status: 'draft', rentAmount: 500 },
  invoice: { amount: 100, description: 'إيجار' },
  receipt: { amount: 50 },
  expense_voucher: { amount: 25, kind: 'expense' },
  payment: { amount: 25, kind: 'payment' },
  owner_statement: {
    ownerName: 'مالك',
    totalRent: 0,
    totalExpenses: 0,
    totalCommission: 0,
    netAmount: 0,
    transactions: [],
  },
  tenant_statement: {
    tenantName: 'مستأجر',
    openingBalance: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    closingBalance: 0,
    lines: [],
  },
  trial_balance: { lines: [{ no: '1', name: 'الصندوق', debit: 1, credit: 0 }], totalDebit: 1, totalCredit: 1 },
  income_statement: { revenues: [], expenses: [], totalRevenue: 0, totalExpense: 0, netIncome: 0 },
  balance_sheet: { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 },
  generic_report: { reportTitle: 'تقرير', sections: [{ title: 'قسم', rows: [] }] },
};

describe('document template registry completeness', () => {
  it('registers exactly the document types the platform honestly supports', () => {
    const types = listDocumentTemplateEntries().map((entry) => entry.type);
    expect(types).toEqual([
      'contract',
      'invoice',
      'receipt',
      'expense_voucher',
      'payment',
      'owner_statement',
      'tenant_statement',
      'trial_balance',
      'income_statement',
      'balance_sheet',
      'generic_report',
    ]);
    expect(new Set(types).size).toBe(types.length);
  });

  it('every entry declares a complete output contract', () => {
    const validSignatureRoles = new Set(['owner', 'tenant', 'accountant', 'general_manager']);
    for (const entry of documentTemplateRegistry) {
      expect(entry.templateId.trim().length, `${entry.type} templateId`).toBeGreaterThan(0);
      expect(entry.templateVersion, `${entry.type} version`).toBe(1);
      expect(entry.supportedOutputs, `${entry.type} outputs`).toEqual(expect.arrayContaining(['print', 'pdf']));
      expect(entry.requiredData.length, `${entry.type} requiredData`).toBeGreaterThan(0);
      expect(entry.businessReference.field.trim().length, `${entry.type} reference field`).toBeGreaterThan(0);
      expect(['omit', 'block']).toContain(entry.businessReference.absentBehavior);
      expect(typeof entry.businessReference.displayAsDocumentNo).toBe('boolean');
      for (const role of entry.signatureRoles) {
        expect(validSignatureRoles.has(role), `${entry.type} unknown signature role ${role}`).toBe(true);
      }
      expect(entry.page, `${entry.type} page policy`).toEqual({
        size: 'A4',
        orientation: 'portrait',
        marginsMm: { top: 12, right: 10, bottom: 15, left: 10 },
      });
      expect(entry.currency, `${entry.type} currency policy`).toEqual({ source: 'company-settings', decimals: 3 });
      expect(['render', 'block']).toContain(entry.emptyState.behavior);
      expect(entry.fileName.strategy).toBe('reference-then-date');
      expect(entry.fileName.prefix.trim().length).toBeGreaterThan(0);
      expect(entry.fileName.maxLength).toBeGreaterThan(10);
      // A header document number is only allowed for real business numbers.
      if (['owner_statement', 'tenant_statement', 'trial_balance', 'income_statement', 'balance_sheet', 'generic_report'].includes(entry.type)) {
        expect(entry.businessReference.displayAsDocumentNo, `${entry.type} must not show a pseudo document number`).toBe(false);
      }
    }
  });

  it('service capabilities are derived from the registry one-to-one', () => {
    const capabilityTypes = listDocumentCapabilities().map((capability) => capability.type);
    expect(capabilityTypes).toEqual(documentTemplateRegistry.map((entry) => entry.type));
  });

  it('lookup helpers behave honestly', () => {
    expect(getDocumentTemplateEntry('invoice')?.type).toBe('invoice');
    expect(getDocumentTemplateEntry('nope')).toBeUndefined();
    expect(() => requireDocumentTemplateEntry('nope')).toThrow(/Unsupported document type/);
    expect(MAX_DOCUMENT_PDF_PAGES).toBeGreaterThan(0);
  });
});

describe('registry↔engine parity — one canonical builder per entry', () => {
  it.each(documentTemplateRegistry.map((entry) => entry.type))('%s builds through the canonical engine', (type) => {
    const model = documentEngine.buildDocument(type as DocumentTypeId, {
      settings,
      payload: minimalPayloads[type as DocumentTypeId] as never,
    });
    expect(model.type).toBe(type);
    expect(model.header.companyName).toBe(settings.companyName);
    expect(model.fileName.trim().length).toBeGreaterThan(0);
    const entry = requireDocumentTemplateEntry(type);
    expect(model.footer.signatures).toEqual([...entry.signatureRoles]);
  });

  it('blocks trial balance output when there are no accounts (registry empty-state: block)', () => {
    expect(() =>
      documentEngine.buildDocument('trial_balance', {
        settings,
        payload: { lines: [], totalDebit: 0, totalCredit: 0 },
      }),
    ).toThrow(/لا يمكن إصدار ميزان مراجعة بدون حسابات/);
  });

  it('rejects non-finite financial data instead of rendering it', () => {
    expect(() =>
      documentEngine.buildDocument('invoice', {
        settings,
        payload: { amount: Number.NaN, description: 'x' },
      }),
    ).toThrow(/قيم مالية غير صالحة/);
  });
});

describe('truthful status labels', () => {
  it('maps only registered truthful labels and falls back without inventing', () => {
    const contractEntry = requireDocumentTemplateEntry('contract');
    expect(truthfulStatusLabel(contractEntry, 'draft')).toBe('مسودة عقد إيجار (غير موقّع)');
    expect(truthfulStatusLabel(contractEntry, 'active')).toBe('عقد إيجار ساري المفعول');
    expect(truthfulStatusLabel(contractEntry, 'terminated')).toBe('عقد إيجار مفسوخ');
    expect(truthfulStatusLabel(contractEntry, null)).toBeNull();
    expect(truthfulStatusLabel(contractEntry, 'unknown_state')).toBe('عقد إيجار');

    const invoiceEntry = requireDocumentTemplateEntry('invoice');
    expect(truthfulStatusLabel(invoiceEntry, 'PAID')).toBe('مدفوعة بالكامل');
    expect(truthfulStatusLabel(invoiceEntry, 'PARTIALLY_PAID')).toBe('مدفوعة جزئياً');
    expect(truthfulStatusLabel(invoiceEntry, 'OVERDUE')).toBe('متأخرة السداد');
    expect(truthfulStatusLabel(invoiceEntry, 'VOID')).toBe('ملغاة');
  });
});

describe('safe deterministic filenames', () => {
  it('strips path-unsafe characters and traversal while keeping Arabic readable', () => {
    expect(sanitizeDocumentFileName('owner-statement-مالك العقار')).toBe('owner-statement-مالك-العقار');
    expect(sanitizeDocumentFileName('../../etc/passwd')).toBe('etc-passwd');
    expect(sanitizeDocumentFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    expect(sanitizeDocumentFileName('   '.repeat(3), 'fallback')).toBe('fallback');
    // A single dot (file extension) is preserved; traversal (`..`) is stripped.
    expect(sanitizeDocumentFileName('receipt-REC-1A2B3C4D.pdf')).toBe('receipt-REC-1A2B3C4D.pdf');
    expect(sanitizeDocumentFileName('report..final')).toBe('reportfinal');
    const longName = sanitizeDocumentFileName(`x-${'ق'.repeat(300)}`);
    expect(longName.length).toBeLessThanOrEqual(96);
    expect(sanitizeDocumentFileName('invoice-INV-100')).toBe('invoice-INV-100');
  });

  it('is deterministic for identical input', () => {
    const value = 'owner-statement-شركة الأفق: فرع مسقط/الخوض';
    expect(sanitizeDocumentFileName(value)).toBe(sanitizeDocumentFileName(value));
  });

  it('filename strategy prefers the real reference, then date, then prefix — and never invents a reference', () => {
    const invoiceEntry = requireDocumentTemplateEntry('invoice');
    expect(buildDocumentFileName(invoiceEntry, { reference: 'INV-100', dueDate: '2026-07-31' })).toBe('invoice-INV-100');
    expect(buildDocumentFileName(invoiceEntry, { reference: null, dueDate: '2026-07-31' })).toBe('invoice-2026-07-31');
    expect(buildDocumentFileName(invoiceEntry, { reference: null, dueDate: null })).toBe('invoice');
    expect(buildDocumentFileName(invoiceEntry, { reference: '9f1c2ab3', dueDate: '2026-07-31' })).toBe('invoice-9f1c2ab3');

    const trialEntry = requireDocumentTemplateEntry('trial_balance');
    expect(buildDocumentFileName(trialEntry, { asOf: null })).toBe('trial-balance');
    expect(buildDocumentFileName(trialEntry, { asOf: '2026-07-31' })).toBe('trial-balance-2026-07-31');
  });
});
