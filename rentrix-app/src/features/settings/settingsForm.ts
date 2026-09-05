/**
 * WP-D compatibility seam — company-settings form surface.
 *
 * The per-section draft types, field maps, and validators now live in
 * `./form/sectionDrafts`; the per-section isolation hook lives in
 * `./form/useSettingsSection`; the section persistence contract lives in
 * `./form/sectionPersistence`. This module keeps the historical import path
 * (`@/features/settings/settingsForm`) and every historical export working:
 * it owns the whole-record adapter functions (record ↔ draft ↔ payload —
 * inherently cross-section because a single Supabase row is saved as one
 * update) and re-exports the decomposed validation contract.
 */
import { normalizeCompanySettingsContract, type CompanyLocalSettings } from '@/lib/companySettings';
import { companySettingsRecordToContract } from './companySettingsContractAdapter';
import type { CompanySettingsRecord, CompanySettingsUpdatePayload } from './companySettingsService';
import {
  companySettingsDraftFields,
  normalizeVatRate,
  stringifyBoolean,
  type CompanySettingsDraft,
  type CompanySettingsDraftField,
  type CompanySettingsDocumentsDraft,
  type CompanySettingsIdentityDraft,
  type CompanySettingsNotificationsDraft,
  type CompanySettingsOfficeDraft,
  type CompanySettingsSectionDraftId,
  type CompanySettingsSectionDraftMap,
  type CompanySettingsValidationErrors,
} from './form/sectionDrafts';

export type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsDocumentsDraft,
  CompanySettingsIdentityDraft,
  CompanySettingsNotificationsDraft,
  CompanySettingsOfficeDraft,
  CompanySettingsSectionDraftId,
  CompanySettingsSectionDraftMap,
  CompanySettingsValidationErrors,
};
export {
  companySettingsDocumentsFields,
  companySettingsDraftFields,
  companySettingsIdentityFields,
  companySettingsNotificationsFields,
  companySettingsOfficeFields,
  companySettingsSectionDraftFields,
  companySettingsSectionDraftIds,
  hasCompanySettingsValidationErrors,
  validateCompanySettingsDraft,
  validateDocumentsSectionDraft,
  validateIdentitySectionDraft,
  validateNotificationsSectionDraft,
  validateOfficeSectionDraft,
  validateSettingsSectionDraft,
} from './form/sectionDrafts';

export function companySettingsRecordToDraft(settings: CompanySettingsRecord): CompanySettingsDraft {
  const normalizedSettings = companySettingsRecordToContract(settings);

  return {
    company_name: normalizedSettings.companyName,
    legal_name: settings.legal_name ?? '',
    tax_number: settings.tax_number ?? '',
    registration_number: settings.registration_number ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    address: settings.address ?? '',
    city: settings.city ?? '',
    country: normalizedSettings.country,
    currency: normalizedSettings.defaultCurrency,
    locale: normalizedSettings.locale,
    timezone: normalizedSettings.timezone,
    date_format: settings.date_format,
    number_format: settings.number_format,
    logo_url: normalizedSettings.logoUrl ?? '',
    invoice_prefix: normalizedSettings.invoicePrefix,
    contract_prefix: normalizedSettings.contractPrefix,
    receipt_prefix: normalizedSettings.receiptPrefix,
    default_vat_rate: String(normalizeVatRate(settings.default_vat_rate)),
    vat_enabled: stringifyBoolean(settings.vat_enabled),
    vat_rate: String(normalizeVatRate(settings.vat_rate ?? settings.default_vat_rate)),
    vat_registration_number: settings.vat_registration_number ?? '',
    notification_email_enabled: stringifyBoolean(settings.notification_email_enabled),
    notification_sms_enabled: stringifyBoolean(settings.notification_sms_enabled),
  };
}

export function companySettingsDraftToPayload(draft: CompanySettingsDraft): CompanySettingsUpdatePayload {
  const normalizedSettings = normalizeCompanySettingsContract({
    companyName: draft.company_name,
    logoUrl: draft.logo_url || null,
    locale: draft.locale,
    defaultCurrency: draft.currency,
    country: draft.country,
    timezone: draft.timezone,
    receiptPrefix: draft.receipt_prefix,
    invoicePrefix: draft.invoice_prefix,
    contractPrefix: draft.contract_prefix,
  });

  return {
    ...draft,
    company_name: normalizedSettings.companyName,
    country: normalizedSettings.country,
    currency: normalizedSettings.defaultCurrency,
    locale: normalizedSettings.locale,
    timezone: normalizedSettings.timezone,
    logo_url: normalizedSettings.logoUrl ?? '',
    invoice_prefix: normalizedSettings.invoicePrefix,
    contract_prefix: normalizedSettings.contractPrefix,
    receipt_prefix: normalizedSettings.receiptPrefix,
    default_vat_rate: normalizeVatRate(draft.default_vat_rate),
    vat_enabled: draft.vat_enabled === 'true',
    vat_rate: normalizeVatRate(draft.vat_rate),
    vat_registration_number: (draft.vat_registration_number ?? '').trim() || null,
    notification_email_enabled: draft.notification_email_enabled === 'true',
    notification_sms_enabled: draft.notification_sms_enabled === 'true',
  };
}

export function companySettingsDraftToLocalSettings(draft: CompanySettingsDraft): CompanyLocalSettings {
  return normalizeCompanySettingsContract({
    companyName: draft.company_name,
    logoUrl: draft.logo_url || null,
    locale: draft.locale,
    defaultCurrency: draft.currency,
    country: draft.country,
    timezone: draft.timezone,
    receiptPrefix: draft.receipt_prefix,
    invoicePrefix: draft.invoice_prefix,
    contractPrefix: draft.contract_prefix,
  });
}


type CompanySettingsPreviewValue = Readonly<{
  label: string;
  value: string;
  isFallback: boolean;
}>;

export type CompanySettingsPreviewModel = Readonly<{
  companyName: string;
  legalName: string;
  logoUrl: string | null;
  logoFallbackLabel: string;
  locale: string;
  defaultLanguage: string;
  defaultCurrency: string;
  country: string;
  timezone: string;
  invoicePrefix: string;
  contractPrefix: string;
  receiptPrefix: string;
  defaultVatRate: string;
  notificationSummary: string;
  contactDetails: readonly CompanySettingsPreviewValue[];
}>;

function previewText(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function buildPreviewValue(label: string, value: string, fallback: string): CompanySettingsPreviewValue {
  const trimmedValue = value.trim();

  return {
    label,
    value: trimmedValue || fallback,
    isFallback: !trimmedValue,
  };
}

export function getCompanySettingsPreviewModel(draft: CompanySettingsDraft): CompanySettingsPreviewModel {
  const normalizedSettings = companySettingsDraftToLocalSettings(draft);

  return {
    companyName: normalizedSettings.companyName,
    legalName: previewText(draft.legal_name, 'غير محدد'),
    logoUrl: normalizedSettings.logoUrl ?? null,
    logoFallbackLabel: normalizedSettings.logoUrl ? '' : 'لا يوجد رابط شعار محفوظ حالياً',
    locale: normalizeCompanySettingsContract({ locale: draft.locale }).locale,
    defaultLanguage: normalizedSettings.defaultLanguage === 'ar' ? 'العربية' : 'الإنجليزية',
    defaultCurrency: normalizedSettings.defaultCurrency,
    country: normalizedSettings.country,
    timezone: normalizedSettings.timezone,
    invoicePrefix: normalizedSettings.invoicePrefix,
    contractPrefix: normalizedSettings.contractPrefix,
    receiptPrefix: normalizedSettings.receiptPrefix,
    defaultVatRate: `${normalizeVatRate(draft.default_vat_rate)}%`,
    notificationSummary: [
      draft.notification_email_enabled === 'true' ? 'البريد الإلكتروني مفعل' : 'البريد الإلكتروني متوقف',
      draft.notification_sms_enabled === 'true' ? 'الرسائل النصية مفعلة' : 'الرسائل النصية متوقفة',
    ].join('، '),
    contactDetails: [
      buildPreviewValue('الهاتف', draft.phone, 'لا يوجد هاتف'),
      buildPreviewValue('البريد الإلكتروني', draft.email, 'لا يوجد بريد إلكتروني'),
      buildPreviewValue('المدينة', draft.city, 'لا توجد مدينة'),
      buildPreviewValue('العنوان', draft.address, 'لا يوجد عنوان'),
      buildPreviewValue('الرقم الضريبي', draft.tax_number, 'لا يوجد رقم ضريبي'),
      buildPreviewValue('السجل التجاري', draft.registration_number, 'لا يوجد سجل تجاري'),
    ],
  };
}

export function areCompanySettingsDraftsEqual(left: CompanySettingsDraft | null, right: CompanySettingsDraft | null): boolean {
  if (!left || !right) return left === right;
  return companySettingsDraftFields.every((field) => left[field] === right[field]);
}
