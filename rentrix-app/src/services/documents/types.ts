export type SignatureRole = 'owner' | 'tenant' | 'accountant' | 'general_manager';

export type DocumentHeader = {
  companyName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyLogoUrl?: string | null;
  companyTaxNumber?: string | null;
  companyRegistrationNumber?: string | null;
  title: string;
  documentNo?: string | null;
  dateLabel?: string | null;
  dateValue?: string | null;
  currency?: string;
};

/**
 * Minimal shape required to render a document's company identity block.
 * Callers must supply real `CompanySettingsContract` data (or an object with
 * the same fields) — the engine intentionally has no built-in fallback
 * company name/address/phone/currency so a missing settings record surfaces
 * as a visible error instead of silently printing placeholder branding.
 */
export type DocumentCompanyIdentity = {
  companyName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  defaultCurrency: string;
};

export type DocumentKpi = { label: string; value: string };

export type DocumentTable = {
  title?: string;
  columns: string[];
  rows: string[][];
  totals?: string[];
};

export type UnifiedDocumentModel = {
  type: string;
  header: DocumentHeader;
  kpis: DocumentKpi[];
  tables: DocumentTable[];
  charts?: Array<{ kind: string; title: string }>;
  footer: {
    signatures: SignatureRole[];
    companyStampLabel?: string | null;
    metadata?: string | null;
  };
  fileName: string;
};

export type DocumentRequest = { type: string; payload: unknown };
