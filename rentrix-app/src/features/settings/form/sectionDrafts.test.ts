// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  companySettingsSectionDraftFields,
  companySettingsSectionDraftIds,
  validateCompanySettingsDraft,
  validateSettingsSectionDraft,
  type CompanySettingsDraft,
} from './sectionDrafts';
import { useSettingsSection } from './useSettingsSection';
import { sectionDraftToSectionPayload, assertSectionFieldOwnership } from './sectionPersistence';

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
  vat_registration_number: '',
  notification_email_enabled: 'true',
  notification_sms_enabled: 'false',
};

describe('per-section draft decomposition', () => {
  it('covers every historical draft field exactly once across the four form sections', () => {
    const allFields = companySettingsSectionDraftIds.flatMap((id) => companySettingsSectionDraftFields[id]);
    expect(allFields).toHaveLength(24);
    expect(new Set(allFields).size).toBe(24);
  });

  it('keeps composed whole-record validation identical to the historical contract', () => {
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

  it('validates only the fields owned by the requested section', () => {
    const officeOnly = validateSettingsSectionDraft({ ...validDraft, company_name: '', invoice_prefix: '' }, 'office');
    expect(officeOnly.company_name).toBe('اسم الشركة مطلوب');
    expect(officeOnly.invoice_prefix).toBeUndefined();

    const documentsOnly = validateSettingsSectionDraft({ ...validDraft, company_name: '', invoice_prefix: '' }, 'documents');
    expect(documentsOnly.invoice_prefix).toBe('بادئة الفواتير مطلوبة');
    expect(documentsOnly.company_name).toBeUndefined();

    const identityOnly = validateSettingsSectionDraft({ ...validDraft, currency: '', logo_url: 'ftp://x.test/a.png' }, 'identity');
    expect(identityOnly.currency).toBe('العملة مطلوبة');
    expect(identityOnly.logo_url).toBe('رابط الشعار يجب أن يبدأ بـ http أو https');
    expect(identityOnly.company_name).toBeUndefined();
  });

  it('keeps optional email blank, accepts simple valid email, and rejects malformed email without regex backtracking risk', () => {
    expect(validateSettingsSectionDraft({ ...validDraft, email: '' }, 'office').email).toBeUndefined();
    expect(validateSettingsSectionDraft({ ...validDraft, email: 'admin@rentrix.app' }, 'office').email).toBeUndefined();
    expect(validateSettingsSectionDraft({ ...validDraft, email: 'admin@@rentrix.app' }, 'office').email).toBe('صيغة البريد الإلكتروني غير صحيحة');
    expect(validateSettingsSectionDraft({ ...validDraft, email: `admin@${'a'.repeat(5000)}` }, 'office').email).toBe('صيغة البريد الإلكتروني غير صحيحة');
  });
});

describe('useSettingsSection', () => {
  it('surfaces the section-owned slice and scoped errors only', () => {
    const onDraftChange = () => undefined;

    const { result } = renderHook(() => useSettingsSection('office', {
      draft: validDraft,
      errors: { company_name: 'اسم الشركة مطلوب', invoice_prefix: 'بادئة الفواتير مطلوبة' },
      isSaving: false,
      onDraftChange,
    }));

    expect(result.current.fields).toEqual(companySettingsSectionDraftFields.office);
    expect(result.current.draft.company_name).toBe('Rentrix');
    expect('invoice_prefix' in result.current.draft).toBe(false);
    expect(result.current.errors).toEqual({ company_name: 'اسم الشركة مطلوب' });
    expect(result.current.isSectionValid).toBe(true);
  });

  it('rejects writes to fields owned by other sections', () => {
    let changed: { field: string; value: string } | null = null;

    const { result } = renderHook(() => useSettingsSection('documents', {
      draft: validDraft,
      errors: {},
      isSaving: false,
      onDraftChange: (field, value) => { changed = { field, value }; },
    }));

    act(() => {
      result.current.setField('invoice_prefix', 'INVX');
      result.current.setField('company_name', 'Hijack');
    });

    expect(changed).toEqual({ field: 'invoice_prefix', value: 'INVX' });
  });

  it('flags section-level validation state for the section it owns', () => {
    const { result } = renderHook(() => useSettingsSection('identity', {
      draft: { ...validDraft, currency: '' },
      errors: {},
      isSaving: false,
      onDraftChange: () => undefined,
    }));

    expect(result.current.isSectionValid).toBe(false);
    expect(result.current.validationErrors.currency).toBe('العملة مطلوبة');
  });
});

describe('section persistence contract (D.4, definition only)', () => {
  it('extracts exactly the section-owned fields into a section payload', () => {
    const payload = sectionDraftToSectionPayload(validDraft, 'notifications');
    expect(payload).toEqual({
      notification_email_enabled: 'true',
      notification_sms_enabled: 'false',
    });
  });

  it('composes the four section payloads into the full draft without gaps or duplicates', () => {
    const composed = assertSectionFieldOwnership(validDraft);
    expect(Object.keys(composed).sort()).toEqual(Object.keys(validDraft).sort());
    expect(composed).toMatchObject(validDraft);
  });
});
