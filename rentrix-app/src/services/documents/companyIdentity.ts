/**
 * Canonical company-identity contract for the document/print/PDF platform.
 *
 * Two historical settings shapes fed document builders:
 *   - `DocumentTemplates.DocumentSettings` (`company.name` + `currency`)
 *   - `DocumentEngine.DocumentSettings` (`company.companyName` + `defaultCurrency`)
 *
 * Both now resolve to this single typed contract. The ONLY adapter that
 * reads the real `company_settings` database record is
 * `documentSettingsFromCompanyRecord`; it never falls back to the platform
 * brand name, a default currency, or a placeholder address — when the
 * record is missing or incomplete, `isReady` is false and document output
 * must be blocked with a visible Arabic explanation.
 */
import { normalizeCompanyLogoUrl } from '@/lib/companySettings';
import { getCurrencySymbol } from '@/lib/numberToArabicWords';

export type DocumentCompanySettings = {
  companyName: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  /** Currency code as stored in company_settings (e.g. `OMR`). */
  currency: string;
  currencySymbol?: string | null;
  documentPrefixes: {
    invoice?: string | null;
    contract?: string | null;
    receipt?: string | null;
  };
};

/**
 * Structural mirror of the `company_settings` row. Declared here (not
 * imported from features/) so the document platform stays a leaf service.
 */
export type CompanySettingsRecordLike = Readonly<{
  company_name?: string | null;
  legal_name?: string | null;
  registration_number?: string | null;
  tax_number?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  currency?: string | null;
  invoice_prefix?: string | null;
  contract_prefix?: string | null;
  receipt_prefix?: string | null;
}>;

/**
 * Thrown whenever a document is requested without a usable company
 * identity. Page components surface `error.message` directly — it is
 * already a complete, user-facing Arabic sentence.
 */
export class MissingDocumentSettingsError extends Error {
  constructor() {
    super('تعذر إنشاء المستند: بيانات هوية الشركة غير مكتملة. يرجى إكمال اسم الشركة والعملة في إعدادات الشركة أولاً.');
    this.name = 'MissingDocumentSettingsError';
  }
}

const trimmedOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function hasCompleteCompanyIdentity(settings: Pick<DocumentCompanySettings, 'companyName' | 'currency'> | null | undefined): boolean {
  return Boolean(settings?.companyName?.trim() && settings?.currency?.trim());
}

/**
 * The single adapter from `company_settings`. `isReady` is false until a
 * real company name and currency are confirmed; no brand-name fallback is
 * ever applied here even though other (non-document) app surfaces default
 * their display name to the product brand.
 */
export function documentSettingsFromCompanyRecord(record: CompanySettingsRecordLike | null | undefined): {
  settings: DocumentCompanySettings;
  isReady: boolean;
} {
  const settings: DocumentCompanySettings = {
    companyName: trimmedOrNull(record?.company_name) ?? '',
    legalName: trimmedOrNull(record?.legal_name),
    registrationNumber: trimmedOrNull(record?.registration_number),
    taxNumber: trimmedOrNull(record?.tax_number),
    address: trimmedOrNull(record?.address),
    phone: trimmedOrNull(record?.phone),
    email: trimmedOrNull(record?.email),
    logoUrl: normalizeCompanyLogoUrl(record?.logo_url),
    currency: trimmedOrNull(record?.currency) ?? '',
    currencySymbol: trimmedOrNull(record?.currency) ? getCurrencySymbol(record!.currency!) : null,
    documentPrefixes: {
      invoice: trimmedOrNull(record?.invoice_prefix),
      contract: trimmedOrNull(record?.contract_prefix),
      receipt: trimmedOrNull(record?.receipt_prefix),
    },
  };
  return { settings, isReady: hasCompleteCompanyIdentity(settings) };
}

/** Asserts a complete identity or throws the canonical Arabic error. */
export function assertDocumentCompanySettings(settings: DocumentCompanySettings | null | undefined): DocumentCompanySettings {
  if (!settings || !hasCompleteCompanyIdentity(settings)) {
    throw new MissingDocumentSettingsError();
  }
  return settings;
}

/**
 * Reference truthfulness guard.
 *
 * A document number must be a real business reference — never a UUID or a
 * UUID fragment. Historical callers passed `entity.id.slice(0, 8)` as the
 * "number"; this helper drops exactly that pattern (and bare UUIDs) while
 * keeping genuine references such as `REC-1A2B3C4D` or `CON-2026-0042`.
 */
export function deriveHonestReference(value: string | null | undefined, entityId?: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  // A bare UUID is an internal identifier, not a document number.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) {
    return null;
  }

  if (entityId) {
    const idCompact = entityId.trim().toLowerCase().replaceAll('-', '');
    const candidateCompact = candidate.toLowerCase().replaceAll('-', '');
    // Reject values that are a raw prefix of the entity id — the shortened-
    // UUID anti-pattern (e.g. `id.slice(0, 8)`), including its hyphenless form.
    if (idCompact && candidateCompact && idCompact.startsWith(candidateCompact)) {
      return null;
    }
  }

  return candidate;
}
