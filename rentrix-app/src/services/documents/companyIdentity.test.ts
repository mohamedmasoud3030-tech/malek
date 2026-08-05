/**
 * Canonical company-identity contract tests.
 *
 * One adapter reads `company_settings`; it must never fall back to the
 * platform brand name or an invented currency, must validate the logo URL,
 * and must expose a truthful readiness gate so UI actions stay disabled
 * until real identity exists.
 */
import { describe, expect, it } from 'vitest';
import {
  assertDocumentCompanySettings,
  deriveHonestReference,
  documentSettingsFromCompanyRecord,
  hasCompleteCompanyIdentity,
  MissingDocumentSettingsError,
} from './companyIdentity';

const fullRecord = {
  company_name: 'شركة الأفق لإدارة الأملاك',
  legal_name: 'شركة الأفق لإدارة الأملاك ش.م.م',
  registration_number: 'CR-1234567',
  tax_number: 'VAT-99001',
  address: 'مسقط، سلطنة عمان',
  phone: '+968 2400 0000',
  email: 'billing@ofoq.example',
  logo_url: 'https://cdn.example.com/logo.png',
  currency: 'OMR',
  invoice_prefix: 'INV',
  contract_prefix: 'CON',
  receipt_prefix: 'REC',
};

describe('documentSettingsFromCompanyRecord — the single company_settings adapter', () => {
  it('maps every retained identity field from the raw record', () => {
    const { settings, isReady } = documentSettingsFromCompanyRecord(fullRecord);
    expect(isReady).toBe(true);
    expect(settings).toMatchObject({
      companyName: fullRecord.company_name,
      legalName: fullRecord.legal_name,
      registrationNumber: fullRecord.registration_number,
      taxNumber: fullRecord.tax_number,
      address: fullRecord.address,
      phone: fullRecord.phone,
      email: fullRecord.email,
      logoUrl: fullRecord.logo_url,
      currency: 'OMR',
      currencySymbol: 'ر.ع',
      documentPrefixes: { invoice: 'INV', contract: 'CON', receipt: 'REC' },
    });
  });

  it('is not ready without a real company name and never invents one', () => {
    const missingName = documentSettingsFromCompanyRecord({ ...fullRecord, company_name: '   ' });
    expect(missingName.isReady).toBe(false);
    expect(missingName.settings.companyName).toBe('');
    expect(missingName.settings.companyName).not.toBe('MALEK');

    const noRecord = documentSettingsFromCompanyRecord(null);
    expect(noRecord.isReady).toBe(false);
    expect(noRecord.settings.companyName).toBe('');
    expect(noRecord.settings.currency).toBe('');
  });

  it('is not ready without a real currency and never invents one', () => {
    const { settings, isReady } = documentSettingsFromCompanyRecord({ ...fullRecord, currency: null });
    expect(isReady).toBe(false);
    expect(settings.currency).toBe('');
    expect(settings.currencySymbol).toBeNull();
  });

  it('validates logo URLs and rejects unsafe schemes', () => {
    expect(documentSettingsFromCompanyRecord({ ...fullRecord, logo_url: 'javascript:alert(1)' }).settings.logoUrl).toBeNull();
    expect(documentSettingsFromCompanyRecord({ ...fullRecord, logo_url: 'data:text/html;base64,PHN2Zz4=' }).settings.logoUrl).toBeNull();
    expect(
      documentSettingsFromCompanyRecord({ ...fullRecord, logo_url: 'data:image/png;base64,iVBORw0KGgo=' }).settings.logoUrl,
    ).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(documentSettingsFromCompanyRecord({ ...fullRecord, logo_url: 'not a url' }).settings.logoUrl).toBeNull();
  });

  it('asserts readiness with a clear Arabic error instead of rendering placeholder branding', () => {
    const { settings } = documentSettingsFromCompanyRecord({ company_name: '', currency: '' });
    expect(() => assertDocumentCompanySettings(settings)).toThrow(MissingDocumentSettingsError);
    expect(() => assertDocumentCompanySettings(settings)).toThrow(/بيانات هوية الشركة غير مكتملة/);
    expect(() => assertDocumentCompanySettings(null)).toThrow(MissingDocumentSettingsError);
    expect(hasCompleteCompanyIdentity(settings)).toBe(false);
    expect(hasCompleteCompanyIdentity({ companyName: 'شركة', currency: 'OMR' })).toBe(true);
  });
});

describe('deriveHonestReference — no UUID fragments as document numbers', () => {
  const entityId = '9f1c2ab3-4d5e-6f70-8a9b-0c1d2e3f4a5b';

  it('keeps real business references', () => {
    expect(deriveHonestReference('REC-9F1C2AB3', '9f1c2ab3-4d5e-6f70-8a9b-0c1d2e3f4a5b')).toBe('REC-9F1C2AB3');
    expect(deriveHonestReference('CON-2026-0042', entityId)).toBe('CON-2026-0042');
    expect(deriveHonestReference('INV-100')).toBe('INV-100');
    expect(deriveHonestReference('TRX-9982', 'rec-1')).toBe('TRX-9982');
  });

  it('drops bare UUIDs', () => {
    expect(deriveHonestReference(entityId)).toBeNull();
    expect(deriveHonestReference(entityId.toUpperCase())).toBeNull();
  });

  it('drops the historical id.slice(0, 8) pattern, including hyphenless forms', () => {
    expect(deriveHonestReference('9f1c2ab3', entityId)).toBeNull();
    expect(deriveHonestReference('9F1C2AB3', entityId)).toBeNull();
    expect(deriveHonestReference('9f1c2ab3-4d5e', entityId)).toBeNull();
  });

  it('drops empty and blank references instead of showing placeholders', () => {
    expect(deriveHonestReference(null)).toBeNull();
    expect(deriveHonestReference(undefined)).toBeNull();
    expect(deriveHonestReference('   ')).toBeNull();
  });
});
