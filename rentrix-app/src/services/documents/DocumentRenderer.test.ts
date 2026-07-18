import { describe, expect, it } from 'vitest';
import { documentEngine } from './DocumentEngine';
import { collectDocumentTextChunks, escapeDocumentHtml } from './DocumentRenderer';
import type { UnifiedDocumentModel } from './types';

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
    const db = {
      settings: { company: { companyName: 'Rentrix', defaultCurrency: 'OMR' } },
      contracts: [{ id: 'contract-1', tenant_id: 'tenant-1', unit_id: 'unit-1', property_id: 'property-1', start_date: '2026-01-01', end_date: '2026-12-31', rent_amount: 100, payment_cycle: 'monthly', status: 'active', cancellation_reason: null, renewed_from_id: null, notes: null, attachment_url: null, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null }],
      tenants: [{ id: 'tenant-1', full_name: '\u0623\u062d\u0645\u062f \u0639\u0644\u064a', phone: null, email: null, national_id: null, type: 'tenant', address: null, notes: null, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null }],
      units: [{ id: 'unit-1', property_id: 'property-1', name: null, unit_number: 'A-1', floor: null, status: 'occupied', rent_amount: 100, notes: null, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null }],
      properties: [{ id: 'property-1', title: '\u0628\u0631\u062c \u0627\u0644\u0646\u064a\u0644', type: 'residential', address: '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', owner_name: null, purchase_value: null, current_value: null, status: 'active', notes: null, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null }],
    };
    const invoice = documentEngine.build({ type: 'invoice', payload: { invoice: { id: 'invoice-1', contract_id: 'contract-1', issue_date: '2026-06-01', due_date: '2026-06-30', amount: 100, paid_amount: 25, status: 'PARTIALLY_PAID', notes: null, created_at: '2026-06-01', updated_at: '2026-06-01', deleted_at: null }, db } });
    const expense = documentEngine.build({ type: 'expense_voucher', payload: { expense: { id: 'expense-1', property_id: 'property-1', category: '\u0635\u064a\u0627\u0646\u0629', amount: 50, expense_date: '2026-06-15', description: '\u0645\u0635\u0639\u062f', attachment_url: null, created_at: '2026-06-15', updated_at: '2026-06-15', deleted_at: null }, db } });

    expect(collectDocumentTextChunks(invoice)).toEqual(expect.arrayContaining(['فاتورة مطالبة مالية', 'المستأجر', 'المبلغ المتبقي واجب السداد']));
    expect(collectDocumentTextChunks(expense)).toEqual(expect.arrayContaining(['سند صرف مصروفات', 'العقار المرتبط', 'برج النيل']));
  });
});
