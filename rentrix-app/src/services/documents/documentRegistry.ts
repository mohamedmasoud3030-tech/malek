/**
 * Central, typed, versioned document template registry.
 *
 * Every document the platform can print or export is registered here with
 * its full output contract: supported outputs, required/optional data,
 * business-reference policy, truthful status labels, signature roles, page
 * policy, currency/precision policy, empty-state behavior, and filename
 * strategy. `DocumentService` derives its capability list from this
 * registry, and `DocumentEngine` owns exactly one builder per entry — a
 * registry↔engine parity test keeps it that way.
 */
import type { DocumentTypeId } from './documentPayloads';
import type { SignatureRole } from './types';

export type DocumentOutputKind = 'print' | 'pdf';

export type BusinessReferencePolicy = Readonly<{
  /** Canonical payload field that carries the real business reference. */
  field: string;
  /**
   * What happens when no real reference exists:
   * - `omit`: render the document without a document-number line. No
   *   reference is invented (UUID fragments were historically shown here).
   * - `block`: refuse output until a real reference is supplied.
   */
  absentBehavior: 'omit' | 'block';
  /**
   * True only for real document numbers shown as "رقم المستند" in the
   * header (contract/invoice/receipt/vouchers). Statement and report
   * identifiers (owner/tenant names, report tags, period labels) feed the
   * filename strategy but are never presented as a document number.
   */
  displayAsDocumentNo: boolean;
}>;

export type PagePolicy = Readonly<{
  size: 'A4';
  orientation: 'portrait' | 'landscape';
  marginsMm: Readonly<{ top: number; right: number; bottom: number; left: number }>;
}>;

export type CurrencyPolicy = Readonly<{
  /** Currency always comes from the real company settings, never a default. */
  source: 'company-settings';
  /** Fixed fractional precision used when rendering amounts (OMR: 3). */
  decimals: 3;
}>;

export type EmptyStatePolicy = Readonly<{
  /**
   * `render`: tables/lists may be empty and say so explicitly in Arabic.
   * `block`: the document is meaningless without rows and output is refused.
   */
  behavior: 'render' | 'block';
  message?: string;
}>;

export type FileNameStrategy = Readonly<{
  /**
   * `reference-then-date`: `<prefix>-<sanitized reference>` when a real
   * reference exists, otherwise `<prefix>-<ISO date>` from `dateField`,
   * otherwise just `<prefix>`. A reference is never invented.
   */
  strategy: 'reference-then-date';
  prefix: string;
  dateField?: string;
  maxLength: number;
}>;

export type DocumentTemplateEntry = Readonly<{
  type: DocumentTypeId;
  templateId: string;
  templateVersion: 1;
  supportedOutputs: readonly DocumentOutputKind[];
  requiredData: readonly string[];
  optionalData: readonly string[];
  businessReference: BusinessReferencePolicy;
  /** Truthful Arabic labels keyed by real status; no label may claim a state the data does not prove. */
  statusLabels: Readonly<Record<string, string>>;
  defaultStatusLabel?: string;
  signatureRoles: readonly SignatureRole[];
  page: PagePolicy;
  currency: CurrencyPolicy;
  emptyState: EmptyStatePolicy;
  fileName: FileNameStrategy;
  notes?: string;
}>;

const A4_PORTRAIT: PagePolicy = {
  size: 'A4',
  orientation: 'portrait',
  marginsMm: { top: 12, right: 10, bottom: 15, left: 10 },
};

const CURRENCY_POLICY: CurrencyPolicy = { source: 'company-settings', decimals: 3 };

const OUTPUTS: readonly DocumentOutputKind[] = ['print', 'pdf'];

export const documentTemplateRegistry: readonly DocumentTemplateEntry[] = [
  {
    type: 'contract',
    templateId: 'rental-contract-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['status', 'rentAmount'],
    optionalData: ['reference', 'startDate', 'endDate', 'paymentCycle', 'notes', 'tenantName', 'tenantNationalId', 'tenantPhone', 'propertyTitle', 'unitNumber'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      draft: 'مسودة عقد إيجار (غير موقّع)',
      active: 'عقد إيجار ساري المفعول',
      expired: 'عقد إيجار منتهي',
      terminated: 'عقد إيجار مفسوخ',
    },
    defaultStatusLabel: 'عقد إيجار',
    signatureRoles: ['owner', 'tenant', 'accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'contract', dateField: 'startDate', maxLength: 80 },
    notes: 'العقد غير المفعّل يحمل حالته الحقيقية صراحة (مسودة غير موقعة/منتهي/مفسوخ).',
  },
  {
    type: 'invoice',
    templateId: 'rent-invoice-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['amount'],
    optionalData: ['reference', 'issueDate', 'dueDate', 'status', 'description', 'paidAmount', 'vatAmount', 'totalAmount', 'tenantName', 'propertyTitle', 'unitNumber'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      PAID: 'مدفوعة بالكامل',
      PARTIALLY_PAID: 'مدفوعة جزئياً',
      UNPAID: 'مستحقة السداد',
      OVERDUE: 'متأخرة السداد',
      VOID: 'ملغاة',
      draft: 'مسودة',
      issued: 'صادرة',
      partial: 'مدفوعة جزئياً',
      paid: 'مدفوعة بالكامل',
      overdue: 'متأخرة السداد',
      void: 'ملغاة',
    },
    defaultStatusLabel: 'مستحقة السداد',
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'invoice', dateField: 'dueDate', maxLength: 80 },
    notes: 'جدول الفواتير لا يخزن رقم فاتورة؛ لا يُعرض مقطع UUID كرقم مستند.',
  },
  {
    type: 'receipt',
    templateId: 'cash-receipt-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['amount'],
    optionalData: ['reference', 'paymentDate', 'paymentMethod', 'payerName', 'propertyTitle', 'unitNumber', 'invoiceReference', 'collectorName', 'paymentReference', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {},
    signatureRoles: ['tenant', 'accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'receipt', dateField: 'paymentDate', maxLength: 80 },
    notes: 'يستخدم رقم الإيصال الحقيقي (REC-…) عند توفره من خدمة الإيصالات.',
  },
  {
    type: 'expense_voucher',
    templateId: 'expense-voucher-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['amount'],
    optionalData: ['reference', 'date', 'category', 'description', 'propertyTitle'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'expense', dateField: 'date', maxLength: 80 },
  },
  {
    type: 'payment',
    templateId: 'money-movement-voucher-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['amount'],
    optionalData: ['reference', 'date', 'category', 'description', 'propertyTitle'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'payment', dateField: 'date', maxLength: 80 },
    notes: 'اسم مستعار قديم بدون مستخدم فعلي؛ يُعرض كسند حركة مالية محايد ولا يدّعي كونه إيصال قبض أو سند صرف.',
  },
  {
    type: 'owner_statement',
    templateId: 'owner-statement-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['ownerName', 'totalRent', 'totalExpenses', 'totalCommission', 'netAmount', 'transactions'],
    optionalData: ['periodFrom', 'periodTo', 'propertyTitle'],
    businessReference: { field: 'ownerName', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render', message: 'لا توجد حركات مالية في الفترة المحددة.' },
    fileName: { strategy: 'reference-then-date', prefix: 'owner-statement', dateField: 'periodTo', maxLength: 80 },
    notes: 'اسم المالك معرف الكشف وليس رقم مرجع؛ لا يُعامل كرقم مستند.',
  },
  {
    type: 'tenant_statement',
    templateId: 'tenant-statement-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['tenantName', 'openingBalance', 'totalInvoiced', 'totalPaid', 'closingBalance', 'lines'],
    optionalData: ['periodFrom', 'periodTo', 'propertyTitle', 'unitNumber'],
    businessReference: { field: 'tenantName', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['tenant', 'accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render', message: 'لا توجد حركات في حساب المستأجر خلال الفترة المحددة.' },
    fileName: { strategy: 'reference-then-date', prefix: 'tenant-statement', dateField: 'periodTo', maxLength: 80 },
  },
  {
    type: 'trial_balance',
    templateId: 'trial-balance-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['lines', 'totalDebit', 'totalCredit'],
    optionalData: ['asOf'],
    businessReference: { field: 'asOf', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'block', message: 'لا يمكن إصدار ميزان مراجعة بدون حسابات.' },
    fileName: { strategy: 'reference-then-date', prefix: 'trial-balance', dateField: 'asOf', maxLength: 80 },
  },
  {
    type: 'income_statement',
    templateId: 'income-statement-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['revenues', 'expenses', 'totalRevenue', 'totalExpense', 'netIncome'],
    optionalData: ['periodFrom', 'periodTo', 'dateRangeLabel'],
    businessReference: { field: 'dateRangeLabel', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render', message: 'لا توجد إيرادات أو مصروفات مسجلة في الفترة.' },
    fileName: { strategy: 'reference-then-date', prefix: 'income-statement', dateField: 'periodTo', maxLength: 80 },
  },
  {
    type: 'balance_sheet',
    templateId: 'balance-sheet-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['assets', 'liabilities', 'equity', 'totalAssets', 'totalLiabilities', 'totalEquity'],
    optionalData: ['asOf'],
    businessReference: { field: 'asOf', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render', message: 'لا توجد أرصدة مسجلة حتى تاريخه.' },
    fileName: { strategy: 'reference-then-date', prefix: 'balance-sheet', dateField: 'asOf', maxLength: 80 },
  },
  {
    type: 'generic_report',
    templateId: 'generic-report-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['reportTitle', 'sections'],
    optionalData: ['reportType', 'periodFrom', 'periodTo', 'totalSummary'],
    businessReference: { field: 'reportType', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render', message: 'لا توجد بيانات لعرضها في هذا التقرير.' },
    fileName: { strategy: 'reference-then-date', prefix: 'report', dateField: 'periodTo', maxLength: 80 },
    notes: 'مدعوم لأن مستخدمين فعليين موجودون (تقارير التحصيل/المتأخرات/الإشغال/المصروفات/الصيانة/الإيراد المؤجل/تحليلات العقارات، ومساحات الودائع والصيانة والمرافق).',
  },
];

const registryByType = new Map<DocumentTypeId, DocumentTemplateEntry>(
  documentTemplateRegistry.map((entry) => [entry.type, entry]),
);

export function getDocumentTemplateEntry(type: string): DocumentTemplateEntry | undefined {
  return registryByType.get(type as DocumentTypeId);
}

export function requireDocumentTemplateEntry(type: string): DocumentTemplateEntry {
  const entry = getDocumentTemplateEntry(type);
  if (!entry) throw new Error(`Unsupported document type: ${type}`);
  return entry;
}

export function listDocumentTemplateEntries(): readonly DocumentTemplateEntry[] {
  return documentTemplateRegistry;
}

/** Translates a real status code into its registered truthful Arabic label. */
export function truthfulStatusLabel(entry: DocumentTemplateEntry, status: string | null | undefined): string | null {
  if (!status) return null;
  return entry.statusLabels[status] ?? entry.defaultStatusLabel ?? status;
}

/** Maximum number of rows a table chunk may contain before its header repeats. */
export const MAX_ROWS_PER_TABLE_CHUNK = 22;

/** Hard cap on rendered PDF pages so pathological documents cannot freeze the browser. */
export const MAX_DOCUMENT_PDF_PAGES = 50;

const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * Produces a safe, readable, deterministic download filename:
 * strips path-unsafe characters and path traversal, converts whitespace to
 * single dashes, collapses separators, caps length, and guarantees a
 * non-empty fallback. Arabic letters are preserved (valid filenames on all
 * supported platforms).
 */
export function sanitizeDocumentFileName(value: string, fallback = 'document'): string {
  const cleaned = value
    .replace(UNSAFE_FILENAME_CHARS, '-')
    .replace(/\.{2,}/g, '') // path traversal
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .trim()
    .replace(/^[-.]+|[-.]+$/g, '');

  const capped = cleaned.length > 96 ? cleaned.slice(0, 96).replace(/[-.]+$/, '') : cleaned;
  return capped || fallback;
}

const isoDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const datePart = value.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
};

/** Applies a registry filename strategy without ever inventing a reference. */
export function buildDocumentFileName(
  entry: DocumentTemplateEntry,
  values: Readonly<Record<string, string | null | undefined>>,
): string {
  const reference = values[entry.businessReference.field]?.trim() || null;
  const dateValue = entry.fileName.dateField ? isoDate(values[entry.fileName.dateField]) : null;
  const core = reference ?? dateValue ?? null;
  const raw = core ? `${entry.fileName.prefix}-${core}` : entry.fileName.prefix;
  return sanitizeDocumentFileName(raw, entry.fileName.prefix);
}
