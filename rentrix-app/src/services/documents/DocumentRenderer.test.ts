import { describe, expect, it } from 'vitest';
import { documentEngine } from './DocumentEngine';
import { collectDocumentTextChunks, escapeDocumentHtml } from './DocumentRenderer';
import type { UnifiedDocumentModel } from './types';
import type { DocumentCompanySettings } from './companyIdentity';

const baseModel: UnifiedDocumentModel = {
  type: 'contract',
  header: { companyName: 'Rentrix', title: 'Contract' },
  kpis: [{ label: 'Tenant', value: 'John Doe' }],
  tables: [{ columns: ['Field', 'Value'], rows: [['Status', 'Active']] }],
  footer: { signatures: ['owner', 'tenant'], companyStampLabel: null, metadata: null },
  fileName: 'x',
};

describe('collectDocumentTextChunks', () => {
  it('escapes user-controlled document text before embedding it in print HTML', () => {
    expect(escapeDocumentHtml(`<img src=x onerror="alert('xss')"> & "quote"`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &quot;quote&quot;',
    );
  });

  it('does not inject default signature labels into Arabic detection chunks', () => {
    const chunks = collectDocumentTextChunks(baseModel);
    expect(chunks.join(' ')).not.toContain('\u062a\u0648\u0642\u064a\u0639');
  });

  it('keeps actual Arabic content in chunks', () => {
    const model: UnifiedDocumentModel = { ...baseModel, header: { ...baseModel.header, title: '\u0639\u0642\u062f \u0625\u064a\u062c\u0627\u0631' } };
    const chunks = collectDocumentTextChunks(model);
    expect(chunks.some((chunk) => /[\u0600-\u06FF]/.test(chunk))).toBe(true);
  });

  it('builds active invoice and expense documents with Arabic labels for RTL output', () => {
    const settings: DocumentCompanySettings = { companyName: 'Rentrix', currency: 'OMR', currencySymbol: 'ر.ع', documentPrefixes: {} };
    const invoice = documentEngine.buildDocument('invoice', {
      settings,
      payload: {
        issueDate: '2026-06-01',
        dueDate: '2026-06-30',
        amount: 100,
        paidAmount: 25,
        status: 'PARTIALLY_PAID',
        description: 'مطالبة إيجارية مستحقة',
        tenantName: 'أحمد علي',
        propertyTitle: 'برج النيل',
        unitNumber: 'A-1',
      },
    });
    const expense = documentEngine.buildDocument('expense_voucher', {
      settings,
      payload: { date: '2026-06-15', category: 'صيانة', amount: 50, description: 'مصعد', propertyTitle: 'برج النيل' },
    });

    // The paid total is an authoritative caller field and passes through; a
    // remaining balance is NOT invented by the document layer.
    expect(collectDocumentTextChunks(invoice)).toEqual(expect.arrayContaining(['فاتورة مطالبة مالية', 'المستأجر', 'إجمالي المدفوع حتى تاريخه']));
    expect(collectDocumentTextChunks(invoice)).not.toContain('المبلغ المتبقي واجب السداد');
    expect(collectDocumentTextChunks(expense)).toEqual(expect.arrayContaining(['سند صرف مصروفات', 'العقار المرتبط', 'برج النيل']));
  });
});
