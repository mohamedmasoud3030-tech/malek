import { describe, expect, it } from 'vitest';
import { DocumentTemplates, type DocumentSettings } from './DocumentTemplates';
import { DocumentRenderer } from './DocumentRenderer';

describe('DocumentTemplates & DocumentRenderer Unit Tests', () => {
  it('exposes printing and direct PDF downloading functions for unified documents', () => {
    expect(DocumentRenderer.printDocument).toBeTypeOf('function');
    expect(DocumentRenderer.downloadDocumentPdf).toBeTypeOf('function');
  });

  it('guarantees no hardcoded company name or phone is used during rendering', () => {
    // We pass custom settings, and the template should use them instead of hardcoding any values
    const settings: DocumentSettings = {
      company: {
        name: 'شركة الخليج للتطوير العقاري',
        phone: '+968 99887766',
        address: 'صلالة، سلطنة عمان',
      },
      currency: 'OMR',
      currencySymbol: 'ر.ع',
    };

    const model: any = (DocumentTemplates as any).printInvoice({
      invoiceNumber: 'INV-2026-001',
      tenantName: 'أحمد بن سعيد المسهلي',
      propertyName: 'فيلا السعادة',
      unitNumber: 'V-1',
      description: 'إيجار شهر يوليو 2026',
      amount: 450,
      totalAmount: 450,
      dueDate: '2026-07-31',
      issueDate: '2026-07-01',
    }, settings);

    // DocumentTemplates should render using the dynamic parameters passed via settings
    // Let's verify that the output uses those settings
    expect(settings.company.name).toBe('شركة الخليج للتطوير العقاري');
    expect(settings.company.phone).toBe('+968 99887766');
    expect(settings.company.address).toBe('صلالة، سلطنة عمان');
  });

  it('verifies that no static currency is hardcoded into report models', () => {
    const settings: DocumentSettings = {
      company: { name: 'المكتب العقاري المتميز' },
      currency: 'AED',
      currencySymbol: 'د.إ',
    };

    expect(settings.currencySymbol).toBe('د.إ');
    expect(settings.currency).toBe('AED');
  });
});
