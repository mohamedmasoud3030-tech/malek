/**
 * WP-D Settings Platform — per-section draft slices (D.2/D.3).
 *
 * The company-settings form used to be one monolithic 24-field draft owned by
 * a single module. This module decomposes that draft into four owned slices —
 * office, identity, documents, notifications — each with:
 *
 *   - its own field map (`companySettingsSectionDraftFields`),
 *   - its own validator (`validate*SectionDraft`),
 *   - a shared composed validator (`validateCompanySettingsDraft`) that keeps
 *     the historical whole-record behavior for the save path.
 *
 * The full `CompanySettingsDraft` type remains the composition of the slices
 * (intersection), so every existing stored field and every compatibility
 * import path is preserved. `CompanySettingsDraftField` is the union of all
 * slice fields — same set as before this decomposition.
 */

export const companySettingsOfficeFields = [
  'company_name',
  'legal_name',
  'tax_number',
  'registration_number',
  'phone',
  'email',
  'address',
  'city',
  'country',
] as const;

export const companySettingsIdentityFields = [
  'currency',
  'locale',
  'timezone',
  'date_format',
  'number_format',
  'logo_url',
] as const;

export const companySettingsDocumentsFields = [
  'invoice_prefix',
  'contract_prefix',
  'receipt_prefix',
  'default_vat_rate',
  'vat_enabled',
  'vat_rate',
  'vat_registration_number',
] as const;

export const companySettingsNotificationsFields = [
  'notification_email_enabled',
  'notification_sms_enabled',
] as const;

export type CompanySettingsOfficeDraft = {
  company_name: string;
  legal_name: string;
  tax_number: string;
  registration_number: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
};

export type CompanySettingsIdentityDraft = {
  currency: string;
  locale: string;
  timezone: string;
  date_format: string;
  number_format: string;
  logo_url: string;
};

export type CompanySettingsDocumentsDraft = {
  invoice_prefix: string;
  contract_prefix: string;
  receipt_prefix: string;
  default_vat_rate: string;
  vat_enabled: string;
  vat_rate: string;
  vat_registration_number: string;
};

export type CompanySettingsNotificationsDraft = {
  notification_email_enabled: string;
  notification_sms_enabled: string;
};

export type CompanySettingsOfficeDraftField = keyof CompanySettingsOfficeDraft;
export type CompanySettingsIdentityDraftField = keyof CompanySettingsIdentityDraft;
export type CompanySettingsDocumentsDraftField = keyof CompanySettingsDocumentsDraft;
export type CompanySettingsNotificationsDraftField = keyof CompanySettingsNotificationsDraft;

/**
 * Sections that own a company-settings draft slice. The registry maps these
 * ids to their field slices; non-form settings sections (cost centers,
 * payment terms, finance readiness, system) own no draft fields.
 */
export const companySettingsSectionDraftIds = ['office', 'identity', 'documents', 'notifications'] as const;

export type CompanySettingsSectionDraftId = (typeof companySettingsSectionDraftIds)[number];

/** Field ownership map: every persisted company-settings field belongs to exactly one section. */
export const companySettingsSectionDraftFields = {
  office: companySettingsOfficeFields,
  identity: companySettingsIdentityFields,
  documents: companySettingsDocumentsFields,
  notifications: companySettingsNotificationsFields,
} as const satisfies Record<CompanySettingsSectionDraftId, readonly CompanySettingsDraftField[]>;

/**
 * The composed draft: intersection of all slices. Preserves the historical
 * single-record shape (every stored field, same names) so `settingsForm.ts`
 * and its consumers see no change.
 */
export type CompanySettingsDraft =
  & CompanySettingsOfficeDraft
  & CompanySettingsIdentityDraft
  & CompanySettingsDocumentsDraft
  & CompanySettingsNotificationsDraft;

export type CompanySettingsDraftField = keyof CompanySettingsDraft;

export type CompanySettingsSectionDraftMap = {
  office: CompanySettingsOfficeDraft;
  identity: CompanySettingsIdentityDraft;
  documents: CompanySettingsDocumentsDraft;
  notifications: CompanySettingsNotificationsDraft;
};

export type CompanySettingsValidationErrors = Partial<Record<CompanySettingsDraftField, string>>;

/** All persisted draft fields, in historical order (used for dirty comparison). */
export const companySettingsDraftFields = [
  ...companySettingsOfficeFields,
  ...companySettingsIdentityFields,
  ...companySettingsDocumentsFields,
  ...companySettingsNotificationsFields,
] as const satisfies readonly CompanySettingsDraftField[];

/* ------------------------------------------------------------------ */
/* Shared normalization/validation helpers (moved from settingsForm)  */
/* ------------------------------------------------------------------ */

export function normalizeVatRate(value: unknown): number {
  const parsedValue = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 100 ? Math.round(parsedValue * 1000) / 1000 : 0;
}

export function stringifyBoolean(value: unknown): string {
  return value === true || value === 'true' ? 'true' : 'false';
}

function hasWhitespace(value: string): boolean {
  return Array.from(value).some((character) => character.trim() === '');
}

function isValidEmailAddress(value: string): boolean {
  const email = value.trim();
  const atIndex = email.indexOf('@');

  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@') || hasWhitespace(email)) return false;

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);
  const dotIndex = domainPart.indexOf('.');

  return Boolean(
    localPart
      && domainPart
      && dotIndex > 0
      && dotIndex < domainPart.length - 1
      && !domainPart.includes('..'),
  );
}

function isValidLogoUrl(value: string): string | undefined {
  if (!value.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    const isSafeRemoteLogo = ['http:', 'https:'].includes(url.protocol);
    const isSafeEmbeddedLogo = url.protocol === 'data:' && /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/i.test(value.trim());
    if (!isSafeRemoteLogo && !isSafeEmbeddedLogo) {
      return 'رابط الشعار يجب أن يبدأ بـ http أو https';
    }
  } catch {
    return 'رابط الشعار غير صحيح';
  }

  return undefined;
}

function isValidVatRate(value: string, message: string): string | undefined {
  const vatRate = Number.parseFloat(value);
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return message;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Per-section validators — each validates ONLY its owned fields.     */
/* ------------------------------------------------------------------ */

export function validateOfficeSectionDraft(draft: CompanySettingsOfficeDraft): CompanySettingsValidationErrors {
  const errors: CompanySettingsValidationErrors = {};

  if (!draft.company_name.trim()) errors.company_name = 'اسم الشركة مطلوب';
  if (draft.email.trim() && !isValidEmailAddress(draft.email)) {
    errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
  }

  return errors;
}

const identityRequiredLabels: Record<CompanySettingsIdentityDraftField, string> = {
  currency: 'العملة مطلوبة',
  locale: 'اللغة/المحلية مطلوبة',
  timezone: 'المنطقة الزمنية مطلوبة',
  date_format: 'صيغة التاريخ مطلوبة',
  number_format: 'صيغة الأرقام مطلوبة',
  logo_url: '',
};

export function validateIdentitySectionDraft(draft: CompanySettingsIdentityDraft): CompanySettingsValidationErrors {
  const errors: CompanySettingsValidationErrors = {};

  for (const field of companySettingsIdentityFields) {
    if (!draft[field].trim()) errors[field] = identityRequiredLabels[field];
  }

  const logoError = isValidLogoUrl(draft.logo_url);
  if (logoError) errors.logo_url = logoError;

  return errors;
}

const documentsRequiredLabels: Record<CompanySettingsDocumentsDraftField, string> = {
  invoice_prefix: 'بادئة الفواتير مطلوبة',
  contract_prefix: 'بادئة العقود مطلوبة',
  receipt_prefix: 'بادئة الإيصالات مطلوبة',
  default_vat_rate: '',
  vat_enabled: '',
  vat_rate: '',
  vat_registration_number: '',
};

export function validateDocumentsSectionDraft(draft: CompanySettingsDocumentsDraft): CompanySettingsValidationErrors {
  const errors: CompanySettingsValidationErrors = {};

  for (const field of companySettingsDocumentsFields) {
    if (field !== 'invoice_prefix' && field !== 'contract_prefix' && field !== 'receipt_prefix') continue;
    if (!draft[field].trim()) errors[field] = documentsRequiredLabels[field];
  }

  const defaultVatError = isValidVatRate(draft.default_vat_rate, 'نسبة ضريبة القيمة المضافة يجب أن تكون بين 0 و100');
  if (defaultVatError) errors.default_vat_rate = defaultVatError;

  const operationalVatError = isValidVatRate(draft.vat_rate, 'نسبة VAT التشغيلية يجب أن تكون بين 0 و100');
  if (operationalVatError) errors.vat_rate = operationalVatError;

  return errors;
}

export function validateNotificationsSectionDraft(): CompanySettingsValidationErrors {
  return {};
}

/* ------------------------------------------------------------------ */
/* Section-scoped + composed validators                               */
/* ------------------------------------------------------------------ */

const sectionValidators = {
  office: validateOfficeSectionDraft,
  identity: validateIdentitySectionDraft,
  documents: validateDocumentsSectionDraft,
  notifications: validateNotificationsSectionDraft,
} as const satisfies Record<CompanySettingsSectionDraftId, (draft: CompanySettingsDraft) => CompanySettingsValidationErrors>;

/**
 * Validates only the draft slice owned by `sectionId`. This is the entry
 * point used by `useSettingsSection` so each section surfaces only its own
 * errors instead of the whole 24-field surface.
 */
export function validateSettingsSectionDraft(
  draft: CompanySettingsDraft,
  sectionId: CompanySettingsSectionDraftId,
): CompanySettingsValidationErrors {
  return sectionValidators[sectionId](draft);
}

/**
 * Whole-record validation — historical behavior preserved: required fields,
 * email format, logo URL safety, and VAT rate ranges across all sections.
 */
export function validateCompanySettingsDraft(draft: CompanySettingsDraft): CompanySettingsValidationErrors {
  const errors: CompanySettingsValidationErrors = {};

  for (const sectionId of companySettingsSectionDraftIds) {
    Object.assign(errors, validateSettingsSectionDraft(draft, sectionId));
  }

  return errors;
}

export function hasCompanySettingsValidationErrors(errors: CompanySettingsValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
