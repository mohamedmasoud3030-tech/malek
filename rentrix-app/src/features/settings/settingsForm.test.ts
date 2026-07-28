import { describe, expect, it } from 'vitest';
import {
  areCompanySettingsDraftsEqual,
  companySettingsDraftToLocalSettings,
  companySettingsDraftToPayload,
  companySettingsRecordToDraft,
  getCompanySettingsPreviewModel,
  validateCompanySettingsDraft,
  type CompanySettingsDraft,
} from './settingsForm';
import { APP_BRAND_NAME } from '@/lib/brand';

const validRecord = {
  id: 'settings_1',
  singleton_key: true,
  company_name: 'Rentrix',
  legal_name: null,
  tax_number: null,
  registration_number: null,
  phone: null,
  email: null,
  address: null,
  city: 'Muscat',
  country: 'OM',
  currency: 'OMR',
  locale: 'ar-OM',
  timezone: 'Asia/Muscat',
  date_format: 'dd/MM/yyyy',
  number_format: 'ar-OM',
  logo_url: null,
  invoice_prefix: 'INV',
  contract_prefix: 'CON',
  receipt_prefix: 'REC',
  default_vat_rate: 5,
  vat_enabled: true,
  vat_rate: 5,
  vat_registration_number: 'VAT-123',
  notification_email_enabled: true,
  notification_sms_enabled: false,
  created_at: '2026-05-18T00:00:00.000Z',
  updated_at: '2026-05-18T00:00:00.000Z',
} as const;

const validDraft: CompanySettingsDraft = {
  company_name: 'Rentrix',
  legal_name: '',
  tax_number: '',
  registration_number: '',
  phone: '',
  email: '',
  address: '',
  city: 'Muscat',
  country: 'OM',
  currency: 'OMR',
  locale: 'ar-OM',
  timezone: 'Asia/Muscat',
  date_format: 'dd/MM/yyyy',
  number_format: 'ar-OM',
  logo_url: '',
  invoice_prefix: 'INV',
  contract_prefix: 'CON',
  receipt_prefix: 'REC',
  default_vat_rate: '5',
  vat_enabled: 'true',
  vat_rate: '5',
  vat_registration_number: 'VAT-123',
  notification_email_enabled: 'true',
  notification_sms_enabled: 'false',
};

describe('settingsForm helpers', () => {
  it('validates required fields and optional email/url formats', () => {
    const errors = validateCompanySettingsDraft({
      ...validDraft,
      company_name: ' ',
      currency: '',
      locale: '',
      timezone: '',
      date_format: '',
      number_format: '',
      invoice_prefix: '',
      contract_prefix: '',
      receipt_prefix: '',
      default_vat_rate: '-1',
      email: 'not-email',
      logo_url: 'ftp://example.test/logo.png',
    });

    expect(errors).toMatchObject({
      company_name: 'اسم الشركة مطلوب',
      currency: 'العملة مطلوبة',
      locale: 'اللغة/المحلية مطلوبة',
      timezone: 'المنطقة الزمنية مطلوبة',
      date_format: 'صيغة التاريخ مطلوبة',
      number_format: 'صيغة الأرقام مطلوبة',
      invoice_prefix: 'بادئة الفواتير مطلوبة',
      contract_prefix: 'بادئة العقود مطلوبة',
      receipt_prefix: 'بادئة الإيصالات مطلوبة',
      default_vat_rate: 'نسبة ضريبة القيمة المضافة يجب أن تكون بين 0 و100',
      email: 'صيغة البريد الإلكتروني غير صحيحة',
      logo_url: 'رابط الشعار يجب أن يبدأ بـ http أو https',
    });
  });

  it('keeps optional email blank, accepts simple valid email, and rejects malformed email without regex backtracking risk', () => {
    expect(validateCompanySettingsDraft({ ...validDraft, email: '' }).email).toBeUndefined();
    expect(validateCompanySettingsDraft({ ...validDraft, email: 'admin@rentrix.app' }).email).toBeUndefined();
    expect(validateCompanySettingsDraft({ ...validDraft, email: 'admin@@rentrix.app' }).email).toBe('صيغة البريد الإلكتروني غير صحيحة');
    expect(validateCompanySettingsDraft({ ...validDraft, email: `admin@${'a'.repeat(5000)}` }).email).toBe('صيغة البريد الإلكتروني غير صحيحة');
  });

  it('detects dirty state by comparing every persisted draft field', () => {
    expect(areCompanySettingsDraftsEqual(validDraft, { ...validDraft })).toBe(true);
    expect(areCompanySettingsDraftsEqual(validDraft, { ...validDraft, contract_prefix: 'LEASE' })).toBe(false);
  });

  it('converts drafts to normalized local settings for formatter/runtime consumers', () => {
    expect(companySettingsDraftToLocalSettings({
      ...validDraft,
      currency: 'XYZ',
      locale: 'en-OM',
      country: 'Oman',
      timezone: 'Europe/Paris',
    })).toMatchObject({
      defaultLanguage: 'en',
      defaultCurrency: 'OMR',
      country: 'OM',
      timezone: 'Asia/Muscat',
    });
  });

  it('normalizes persisted record values before binding settings controls', () => {
    expect(companySettingsRecordToDraft({
      ...validRecord,
      company_name: '  ',
      country: 'Oman',
      currency: 'XYZ',
      locale: 'en-OM',
      timezone: 'Europe/Paris',
      logo_url: ' https://example.test/logo.png ',
      invoice_prefix: '',
      contract_prefix: '',
      receipt_prefix: '',
      default_vat_rate: -2,
      vat_enabled: true,
      vat_rate: 5,
      vat_registration_number: null,
      notification_email_enabled: false,
      notification_sms_enabled: true,
    })).toMatchObject({
      company_name: APP_BRAND_NAME,
      country: 'OM',
      currency: 'OMR',
      locale: 'en-OM',
      timezone: 'Asia/Muscat',
      logo_url: 'https://example.test/logo.png',
      invoice_prefix: 'INV',
      contract_prefix: 'CON',
      receipt_prefix: 'REC',
      default_vat_rate: '0',
      notification_email_enabled: 'false',
      notification_sms_enabled: 'true',
    });
  });

  it('normalizes draft option values before saving the update payload', () => {
    expect(companySettingsDraftToPayload({
      ...validDraft,
      company_name: '  Rentrix Oman  ',
      country: 'Oman',
      currency: 'XYZ',
      locale: 'fr-FR',
      timezone: 'Europe/Paris',
      logo_url: ' https://example.test/logo.png ',
      invoice_prefix: '',
      contract_prefix: '',
      receipt_prefix: '',
      default_vat_rate: '101',
      notification_email_enabled: 'false',
      notification_sms_enabled: 'true',
    })).toMatchObject({
      company_name: 'Rentrix Oman',
      country: 'OM',
      currency: 'OMR',
      locale: 'ar-OM',
      timezone: 'Asia/Muscat',
      logo_url: 'https://example.test/logo.png',
      invoice_prefix: 'INV',
      contract_prefix: 'CON',
      receipt_prefix: 'REC',
      default_vat_rate: 0,
      notification_email_enabled: false,
      notification_sms_enabled: true,
    });
  });


  it('builds a branding and document preview model with safe fallbacks', () => {
    const preview = getCompanySettingsPreviewModel({
      ...validDraft,
      company_name: '  Rentrix Oman  ',
      legal_name: ' ',
      logo_url: 'javascript:alert(1)',
      locale: 'en-OM',
      currency: 'XYZ',
      country: 'Oman',
      timezone: 'Europe/Paris',
      invoice_prefix: '',
      contract_prefix: '',
      receipt_prefix: '   ',
      default_vat_rate: '7.5',
      notification_email_enabled: 'true',
      notification_sms_enabled: 'false',
      phone: '',
      email: '',
      address: '  ',
    });

    expect(preview).toMatchObject({
      companyName: 'Rentrix Oman',
      legalName: 'غير محدد',
      logoUrl: null,
      logoFallbackLabel: 'لا يوجد رابط شعار محفوظ حالياً',
      locale: 'en-OM',
      defaultLanguage: 'الإنجليزية',
      defaultCurrency: 'OMR',
      country: 'OM',
      timezone: 'Asia/Muscat',
      invoicePrefix: 'INV',
      contractPrefix: 'CON',
      receiptPrefix: 'REC',
      defaultVatRate: '7.5%',
    });
    expect(preview.contactDetails).toContainEqual({ label: 'الهاتف', value: 'لا يوجد هاتف', isFallback: true });
    expect(preview.contactDetails).toContainEqual({ label: 'العنوان', value: 'لا يوجد عنوان', isFallback: true });
  });

  it('keeps safe http and https logo URLs available for the preview', () => {
    expect(getCompanySettingsPreviewModel({
      ...validDraft,
      logo_url: ' https://example.test/logo.png ',
    }).logoUrl).toBe('https://example.test/logo.png');
  });

  it('converts drafts to update payloads without dropping persisted fields', () => {
    expect(companySettingsDraftToPayload(validDraft)).toEqual({
      company_name: 'Rentrix',
      legal_name: '',
      tax_number: '',
      registration_number: '',
      phone: '',
      email: '',
      address: '',
      city: 'Muscat',
      country: 'OM',
      currency: 'OMR',
      locale: 'ar-OM',
      timezone: 'Asia/Muscat',
      date_format: 'dd/MM/yyyy',
      number_format: 'ar-OM',
      logo_url: '',
      invoice_prefix: 'INV',
      contract_prefix: 'CON',
      receipt_prefix: 'REC',
      default_vat_rate: 5,
      vat_enabled: true,
      vat_rate: 5,
      vat_registration_number: 'VAT-123',
      notification_email_enabled: true,
      notification_sms_enabled: false,
    });
  });
});
