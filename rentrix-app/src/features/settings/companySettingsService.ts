import { supabase } from '@/lib/supabase';
import { APP_BRAND_NAME } from '@/lib/brand';
import { normalizeCompanyLocale, normalizeCompanyLogoUrl, normalizeCountry, normalizeTimezone } from '@/lib/companySettings';
import { normalizeCurrency } from '@/lib/formatters';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database } from '@/types/database';

export type CompanySettingsRecord = Database['public']['Tables']['company_settings']['Row'];

export type CompanySettingsUpdatePayload = Partial<Pick<CompanySettingsRecord,
  | 'company_name'
  | 'legal_name'
  | 'tax_number'
  | 'registration_number'
  | 'phone'
  | 'email'
  | 'address'
  | 'city'
  | 'country'
  | 'currency'
  | 'locale'
  | 'timezone'
  | 'date_format'
  | 'number_format'
  | 'logo_url'
  | 'invoice_prefix'
  | 'contract_prefix'
  | 'receipt_prefix'
  | 'default_vat_rate'
  | 'vat_enabled'
  | 'vat_rate'
  | 'vat_registration_number'
  | 'notification_email_enabled'
  | 'notification_sms_enabled'
>>;

type CompanySettingsUpdate = Database['public']['Tables']['company_settings']['Update'];

type ImmutableCompanySettingsKey = Exclude<keyof CompanySettingsRecord, keyof CompanySettingsUpdatePayload>;

export const DEFAULT_COMPANY_SETTINGS_ID = '00000000-0000-4000-8000-000000000001';

const defaultTimestamps = '1970-01-01T00:00:00.000Z';

const defaultCompanySettings: CompanySettingsRecord = {
  id: DEFAULT_COMPANY_SETTINGS_ID,
  singleton_key: true,
  company_name: APP_BRAND_NAME,
  legal_name: null,
  tax_number: null,
  registration_number: null,
  phone: null,
  email: null,
  address: null,
  city: null,
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
  default_vat_rate: 0,
  vat_enabled: false,
  vat_rate: 5,
  vat_registration_number: null,
  notification_email_enabled: true,
  notification_sms_enabled: false,
  created_at: defaultTimestamps,
  updated_at: defaultTimestamps,
};

const nullableStringFields = [
  'legal_name',
  'tax_number',
  'registration_number',
  'phone',
  'email',
  'address',
  'city',
  'country',
  'logo_url',
  'vat_registration_number',
] as const;

const requiredStringFields = [
  'company_name',
  'currency',
  'locale',
  'timezone',
  'date_format',
  'number_format',
  'invoice_prefix',
  'contract_prefix',
  'receipt_prefix',
] as const;

const numericFields = ['default_vat_rate', 'vat_rate'] as const;

const booleanFields = ['vat_enabled', 'notification_email_enabled', 'notification_sms_enabled'] as const;

const updateableFields = new Set<keyof CompanySettingsUpdatePayload>([
  ...nullableStringFields,
  ...requiredStringFields,
  ...numericFields,
  ...booleanFields,
]);

function stringifyPrimitive(value: unknown): string | null {
  switch (typeof value) {
    case 'string':
      return value.trim();
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value).trim();
    default:
      return null;
  }
}

function normalizeVatRate(value: unknown): number {
  const parsedValue = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 100) return defaultCompanySettings.default_vat_rate;
  return Math.round(parsedValue * 1000) / 1000;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true') return true;
    if (normalizedValue === 'false') return false;
  }
  return fallback;
}

function cleanNullableString(value: unknown): string | null {
  return stringifyPrimitive(value) || null;
}

function cleanRequiredString(value: unknown, fallback: string): string {
  return stringifyPrimitive(value) || fallback;
}

function normalizeRequiredCompanySettingsField(field: (typeof requiredStringFields)[number], value: unknown): string {
  const cleanedValue = cleanRequiredString(value, defaultCompanySettings[field]);

  switch (field) {
    case 'currency':
      return normalizeCurrency(cleanedValue);
    case 'locale':
      return normalizeCompanyLocale(cleanedValue);
    case 'timezone':
      return normalizeTimezone(cleanedValue);
    default:
      return cleanedValue;
  }
}

function normalizeNullableCompanySettingsField(field: (typeof nullableStringFields)[number], value: unknown): string | null {
  if (field === 'country') {
    return normalizeCountry(value);
  }

  if (field === 'logo_url') {
    return normalizeCompanyLogoUrl(value);
  }

  return cleanNullableString(value);
}

export function normalizeCompanySettingsRecord(value: Partial<CompanySettingsRecord> | null | undefined): CompanySettingsRecord {
  const source = value ?? defaultCompanySettings;
  const normalized = { ...defaultCompanySettings, ...source };

  for (const field of nullableStringFields) {
    normalized[field] = normalizeNullableCompanySettingsField(field, normalized[field]);
  }

  for (const field of requiredStringFields) {
    normalized[field] = normalizeRequiredCompanySettingsField(field, normalized[field]);
  }

  normalized.default_vat_rate = normalizeVatRate(normalized.default_vat_rate);
  normalized.vat_rate = normalizeVatRate(normalized.vat_rate);
  normalized.vat_enabled = normalizeBoolean(normalized.vat_enabled, defaultCompanySettings.vat_enabled ?? false);
  normalized.notification_email_enabled = normalizeBoolean(normalized.notification_email_enabled, defaultCompanySettings.notification_email_enabled);
  normalized.notification_sms_enabled = normalizeBoolean(normalized.notification_sms_enabled, defaultCompanySettings.notification_sms_enabled);

  normalized.id = cleanRequiredString(normalized.id, defaultCompanySettings.id);
  normalized.created_at = cleanRequiredString(normalized.created_at, defaultCompanySettings.created_at);
  normalized.updated_at = cleanRequiredString(normalized.updated_at, defaultCompanySettings.updated_at);
  normalized.singleton_key = true;

  return normalized;
}

export function normalizeCompanySettingsUpdatePayload(payload: CompanySettingsUpdatePayload): CompanySettingsUpdatePayload {
  const normalized: CompanySettingsUpdatePayload = {};

  for (const [key, value] of Object.entries(payload) as [keyof CompanySettingsUpdatePayload | ImmutableCompanySettingsKey, unknown][]) {
    if (!updateableFields.has(key as keyof CompanySettingsUpdatePayload)) continue;

    if ((nullableStringFields as readonly string[]).includes(key)) {
      normalized[key as (typeof nullableStringFields)[number]] = normalizeNullableCompanySettingsField(key as (typeof nullableStringFields)[number], value);
      continue;
    }

    const requiredKey = key as (typeof requiredStringFields)[number];
    if ((requiredStringFields as readonly string[]).includes(key)) {
      normalized[requiredKey] = normalizeRequiredCompanySettingsField(requiredKey, value);
      continue;
    }

    if (key === 'default_vat_rate' || key === 'vat_rate') {
      normalized[key] = normalizeVatRate(value);
      continue;
    }

    if (key === 'vat_enabled') {
      normalized.vat_enabled = normalizeBoolean(value, defaultCompanySettings.vat_enabled ?? false);
      continue;
    }

    if (key === 'notification_email_enabled') {
      normalized.notification_email_enabled = normalizeBoolean(value, defaultCompanySettings.notification_email_enabled);
      continue;
    }

    if (key === 'notification_sms_enabled') {
      normalized.notification_sms_enabled = normalizeBoolean(value, defaultCompanySettings.notification_sms_enabled);
    }
  }

  return normalized;
}

export async function getCompanySettings(): Promise<CompanySettingsRecord> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'تعذر تحميل إعدادات الشركة');
  if (!data) return defaultCompanySettings;

  return normalizeCompanySettingsRecord(data);
}

export async function updateCompanySettings(payload: CompanySettingsUpdatePayload): Promise<CompanySettingsRecord> {
  const currentSettings = await getCompanySettings();
  const updatePayload: CompanySettingsUpdate = normalizeCompanySettingsUpdatePayload(payload);

  const { data, error } = await supabase
    .from('company_settings')
    .update(updatePayload)
    .eq('id', currentSettings.id)
    .select('*')
    .single();

  if (error) handleSupabaseError(error, 'تعذر حفظ إعدادات الشركة');
  return normalizeCompanySettingsRecord(data);
}
