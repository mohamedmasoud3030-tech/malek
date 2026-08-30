export type SignatureRole = 'owner' | 'tenant' | 'accountant' | 'general_manager' | 'inspector' | 'vendor';

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

/* ------------------------------------------------------------------ */
/* Professional report primitives (owner_report / property_report)     */
/*                                                                     */
/* These primitives are the document language of MALEK professional    */
/* A4 reports. They share the engine's print/PDF pipeline, pagination  */
/* and currency policy with every other document, but model a report   */
/* composition (KPI strips, charts, keep-together groups) that simple  */
/* statements do not need.                                             */
/* ------------------------------------------------------------------ */

/**
 * One KPI in a report KPI strip. Values are PRE-FORMATTED strings: the
 * engine builder formats typed payload cells with company currency
 * precision before they reach this model, so the renderer never formats
 * money and internal and print representations can never diverge.
 */
export type ReportKpi = {
  label: string;
  value: string;
  /** Signed change vs the comparable previous period (engine-formatted). */
  comparison?: string | null;
};

/** Deterministic, print-safe chart data (rendered as inline SVG). */
export type ReportChart = {
  chartType: 'bars' | 'hbar' | 'stacked-bars';
  title: string;
  caption?: string | null;
  /** Category labels (months, bucket names, categories). */
  categories: string[];
  /** Series labels + numeric values (aligned with categories). */
  series: Array<{ name: string; values: number[] }>;
  /** Explanatory note rendered with the chart (never hover-only). */
  note?: string | null;
};

/** Compact report table (already-formatted by the engine builder). */
export type ReportTable = {
  title?: string | null;
  columns: string[];
  rows: string[][];
  totals?: string[];
  emptyNote?: string | null;
};

/** Insight / risk note. */
export type ReportNote = { text: string; tone: 'info' | 'risk' | 'success' | 'neutral' };

export type ProfessionalReportBlock =
  | { kind: 'kpis'; kpis: ReportKpi[] }
  | { kind: 'table'; table: ReportTable }
  | { kind: 'chart'; chart: ReportChart }
  | { kind: 'note'; note: ReportNote };

/**
 * A report composition group. Each group is laid out as one or more atomic
 * page blocks; `keepTogether` wraps the whole group in ONE atomic block so
 * the paginator can only move it wholesale (never split mid-group). It must
 * only be used when the combined content is known to fit a single A4 page —
 * the engine renders it as-is and cannot rescue an oversized keep-together
 * group, so payload adapters are responsible for sizing.
 */
export type ProfessionalReportGroup = {
  keepTogether?: boolean;
  blocks: ProfessionalReportBlock[];
};

/** Optional body of a professional report document (owner_report / property_report). */
export type ProfessionalReportBody = {
  /** Identity facts rendered under the header: owner name, property scope, period… */
  identity: Array<{ label: string; value: string }>;
  groups: ProfessionalReportGroup[];
};

export type DocumentTable = {
  title?: string;
  columns: string[];
  rows: string[][];
  totals?: string[];
  /** Explicit Arabic note rendered as a full-width row when `rows` is empty. */
  emptyNote?: string;
};

export type UnifiedDocumentModel = {
  type: string;
  header: DocumentHeader;
  kpis: DocumentKpi[];
  tables: DocumentTable[];
  charts?: Array<{ kind: string; title: string }>;
  /**
   * Professional report body (owner_report / property_report). When present,
   * the renderer composes the document exclusively from this body (identity
   * strip + groups); `kpis`/`tables`/`charts` stay empty for these types.
   */
  professional?: ProfessionalReportBody;
  footer: {
    signatures: SignatureRole[];
    companyStampLabel?: string | null;
    metadata?: string | null;
  };
  fileName: string;
};

export type DocumentRequest = { type: string; payload: unknown };
