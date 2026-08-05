/**
 * Canonical typed DocumentEngine — the ONLY source of `UnifiedDocumentModel`.
 *
 * Public surface:
 *
 *  - `documentEngine.buildDocument(type, { settings, payload })`
 *      The canonical, typed API. Payloads follow `documentPayloads.ts` and
 *      are validated against the template registry (`documentRegistry.ts`).
 *
 *  - `documentEngine.build(request)`  (compatibility)
 *      Normalizes the historical `{ invoice, db }`-style requests through
 *      `legacyPayloadAdapters.ts` and then takes the exact same canonical
 *      path. No builder logic lives outside this engine.
 *
 * Truthfulness rules enforced here:
 *  - company identity is asserted real and complete (never a brand name,
 *    never a fallback address/currency);
 *  - document numbers come only from real business references — UUID
 *    fragments are dropped by the adapters, never displayed;
 *  - status wording is taken from the registry's registered labels only;
 *  - amounts pass through unchanged (this engine never recalculates money).
 */
import type { Contract, Expense, Invoice, Receipt } from '@/types/domain';
import '@/lib/formatters';
import { getCurrencySymbol, getCurrencyWordConfig, numberToArabicWords } from '@/lib/numberToArabicWords';
import { TableGenerator } from './TableGenerator';
import type { DocumentHeader, DocumentRequest, DocumentTable, UnifiedDocumentModel } from './types';
import { formatLatinDate, formatLatinNumber } from '@/lib/formatters';
import {
  assertDocumentCompanySettings,
  deriveHonestReference,
  MissingDocumentSettingsError,
  type DocumentCompanySettings,
} from './companyIdentity';
import {
  buildDocumentFileName,
  getDocumentTemplateEntry,
  requireDocumentTemplateEntry,
  truthfulStatusLabel,
  type DocumentTemplateEntry,
} from './documentRegistry';
import type {
  BalanceSheetReportPayload,
  CanonicalDocumentPayloadMap,
  ContractDocumentPayload,
  DocumentBuildInput,
  DocumentTypeId,
  ExpenseVoucherPayload,
  GenericReportPayload,
  IncomeStatementReportPayload,
  InvoiceDocumentPayload,
  MoneyRow,
  OwnerStatementPayload,
  ReceiptDocumentPayload,
  TenantStatementPayload,
  TrialBalanceReportPayload,
} from './documentPayloads';
import {
  legacyBalanceSheetToCanonical,
  legacyContractToCanonical,
  legacyExpenseToCanonical,
  legacyIncomeStatementToCanonical,
  legacyInvoiceToCanonical,
  legacyOwnerStatementToCanonical,
  legacyReceiptToCanonical,
  legacySettingsToCanonical,
  legacyTenantStatementToCanonical,
  legacyTrialBalanceToCanonical,
  type LegacyAppLikeDb,
  type LegacyBalanceSheetPayload,
  type LegacyIncomeStatementPayload,
  type LegacyOwnerStatementPayload,
  type LegacyTenantStatementPayload,
  type LegacyTrialBalancePayload,
} from './legacyPayloadAdapters';

/* ------------------------------------------------------------------ */
/* Backward-compatible public types                                     */
/* ------------------------------------------------------------------ */

/**
 * Historical engine settings shape. Kept as an alias so existing callers
 * keep compiling; new code should use `DocumentCompanySettings`.
 */
export type DocumentSettings = { company: import('./legacyPayloadAdapters').LegacyDocumentSettingsIdentity };

/** @deprecated use `MissingDocumentSettingsError` (canonical, same class). */
export const MissingCompanyIdentityError = MissingDocumentSettingsError;
export type MissingCompanyIdentityError = MissingDocumentSettingsError;

/** Legacy payload type names kept for `pdfService` and migrating callers. */
export type OwnerStatementDataPayload = LegacyOwnerStatementPayload;
export type TenantStatementDataPayload = LegacyTenantStatementPayload;
export type TrialBalancePayload = LegacyTrialBalancePayload;
export type IncomeStatementPayload = LegacyIncomeStatementPayload;
export type BalanceSheetPayload = LegacyBalanceSheetPayload;

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

/** Thrown on invalid/non-finite required document data (Arabic, user-facing). */
export class DocumentDataError extends Error {
  constructor(detail: string) {
    super(`لا يمكن إنشاء المستند: ${detail}`);
    this.name = 'DocumentDataError';
  }
}

const REQUIRED_ARRAY_FIELDS = new Set(['transactions', 'lines', 'sections', 'revenues', 'expenses', 'assets', 'liabilities', 'equity']);
const REQUIRED_NUMBER_FIELDS = new Set([
  'amount', 'rentAmount', 'paidAmount', 'totalRent', 'totalExpenses', 'totalCommission', 'netAmount',
  'openingBalance', 'totalInvoiced', 'totalPaid', 'closingBalance', 'totalDebit', 'totalCredit',
  'totalRevenue', 'totalExpense', 'netIncome', 'totalAssets', 'totalLiabilities', 'totalEquity',
]);

function validatePayload(entry: DocumentTemplateEntry, payload: Readonly<Record<string, unknown>>): void {
  for (const field of entry.requiredData) {
    const value = payload[field];
    if (REQUIRED_ARRAY_FIELDS.has(field)) {
      if (!Array.isArray(value)) throw new DocumentDataError('بيانات المستند ناقصة أو غير صالحة.');
      continue;
    }
    if (REQUIRED_NUMBER_FIELDS.has(field)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new DocumentDataError('قيم مالية غير صالحة في بيانات المستند.');
      }
      continue;
    }
    if (value == null || (typeof value === 'string' && !value.trim())) {
      throw new DocumentDataError('بيانات المستند ناقصة أو غير صالحة.');
    }
  }

  if (entry.emptyState.behavior === 'block') {
    for (const field of entry.requiredData) {
      if (REQUIRED_ARRAY_FIELDS.has(field) && Array.isArray(payload[field]) && (payload[field] as unknown[]).length === 0) {
        throw new DocumentDataError(entry.emptyState.message ?? 'لا توجد بيانات لإصدار هذا المستند.');
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Formatting helpers (strict pass-through of caller-supplied numbers)  */
/* ------------------------------------------------------------------ */

type FormatContext = Readonly<{ symbol: string; currencyCode: string }>;

const formatContextOf = (settings: DocumentCompanySettings): FormatContext => ({
  symbol: settings.currencySymbol?.trim() || getCurrencySymbol(settings.currency),
  currencyCode: settings.currency,
});

const money = (value: number, ctx: FormatContext): string =>
  `${Number.isFinite(value) ? formatLatinNumber(value, 'ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '0.000'} ${ctx.symbol}`;

const words = (value: number, ctx: FormatContext): string =>
  numberToArabicWords(value, getCurrencyWordConfig(ctx.currencyCode));

/** Long, print-friendly Arabic date; passes through non-ISO labels untouched. */
const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const datePart = value.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length < 3) return value;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return formatLatinDate(date, 'ar-OM', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDocumentValue = (value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '—' : formatLatinDate(value, 'ar-OM');
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return '—';
};

const kpi = (label: string, value: unknown) => ({ label, value: formatDocumentValue(value) });

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
};

/* ------------------------------------------------------------------ */
/* Model assembly                                                       */
/* ------------------------------------------------------------------ */

function buildHeader(
  settings: DocumentCompanySettings,
  entry: DocumentTemplateEntry,
  options: {
    title: string;
    reference?: string | null;
    dateLabel?: string | null;
    dateValue?: string | null;
    ctx: FormatContext;
  },
): DocumentHeader {
  const reference = options.reference?.trim() || null;
  return {
    companyName: settings.legalName?.trim() || settings.companyName,
    companyAddress: settings.address ?? null,
    companyPhone: settings.phone ?? null,
    companyEmail: settings.email ?? null,
    companyLogoUrl: settings.logoUrl ?? null,
    companyTaxNumber: settings.taxNumber ?? null,
    companyRegistrationNumber: settings.registrationNumber ?? null,
    title: reference ? `${options.title} رقم ${reference}` : options.title,
    documentNo: entry.businessReference.displayAsDocumentNo ? reference : null,
    dateLabel: options.dateLabel ?? null,
    dateValue: options.dateValue ?? null,
    currency: options.ctx.symbol,
  };
}

function buildFooter(entry: DocumentTemplateEntry, metadata: string | null) {
  return {
    signatures: [...entry.signatureRoles],
    // A company stamp never implies approval took place; only a caller with
    // real stamp data may set a label, and this engine invents none.
    companyStampLabel: null,
    metadata,
  };
}

const joinPropertyUnit = (propertyTitle?: string | null, unitNumber?: string | null): string | null => {
  if (!propertyTitle && !unitNumber) return null;
  return `${propertyTitle || '—'} / ${unitNumber || '—'}`;
};

/* ------------------------------------------------------------------ */
/* Canonical per-type builders (one per registry entry, nowhere else)   */
/* ------------------------------------------------------------------ */

function buildContractModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: ContractDocumentPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  const title = truthfulStatusLabel(entry, payload.status) ?? 'عقد إيجار';
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title,
      reference: payload.reference,
      dateLabel: 'تاريخ بداية العقد',
      dateValue: formatDate(payload.startDate),
      ctx,
    }),
    kpis: [
      kpi('المستأجر', payload.tenantName),
      kpi('رقم الهوية / السجل', payload.tenantNationalId),
      kpi('رقم الهاتف', payload.tenantPhone),
      kpi('العقار والوحدة', joinPropertyUnit(payload.propertyTitle, payload.unitNumber)),
      kpi('فترة العقد', payload.startDate || payload.endDate ? `${formatDate(payload.startDate)} إلى ${formatDate(payload.endDate)}` : null),
      kpi('قيمة الإيجار', money(payload.rentAmount, ctx)),
      kpi('دورة السداد', payload.paymentCycle),
    ],
    tables: [
      TableGenerator.build(
        ['بند العقد', 'التفاصيل المالية والقانونية'],
        [
          ['قيمة الإيجار بالإرقام', money(payload.rentAmount, ctx)],
          ['قيمة الإيجار بالحروف (تفقيط)', words(payload.rentAmount, ctx)],
          ['دورة الدفع المسجلة', payload.paymentCycle || '—'],
          ['ملاحظات العقد', payload.notes?.trim() || 'لا توجد شروط إضافية'],
        ],
      ),
    ],
    footer: buildFooter(entry, payload.reference ? `رقم العقد: ${payload.reference}` : title),
    fileName: buildDocumentFileName(entry, { reference: payload.reference, startDate: payload.startDate }),
  };
}

function buildInvoiceModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: InvoiceDocumentPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  const vat = payload.vatAmount ?? 0;
  const total = payload.totalAmount ?? payload.amount + vat;
  const hasPayments = payload.paidAmount != null;
  const remaining = Math.max(0, total - (payload.paidAmount ?? 0));
  const statusLabel = truthfulStatusLabel(entry, payload.status);

  const rows: string[][] = [[payload.description?.trim() || 'مطالبة مستحقة', money(payload.amount, ctx)]];
  if (vat) rows.push(['ضريبة القيمة المضافة', money(vat, ctx)]);
  if (hasPayments) {
    rows.push(['إجمالي المدفوع حتى تاريخه', money(payload.paidAmount ?? 0, ctx)]);
    rows.push(['المبلغ المتبقي واجب السداد', money(remaining, ctx)]);
  }

  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: 'فاتورة مطالبة مالية',
      reference: payload.reference,
      dateLabel: payload.issueDate ? 'تاريخ الإصدار' : 'تاريخ الاستحقاق',
      dateValue: formatDate(payload.issueDate ?? payload.dueDate),
      ctx,
    }),
    kpis: [
      kpi('المستأجر', payload.tenantName),
      kpi('العقار / الوحدة', joinPropertyUnit(payload.propertyTitle, payload.unitNumber)),
      kpi('تاريخ الاستحقاق', payload.dueDate ? formatDate(payload.dueDate) : null),
      kpi('وصف المطالبة', payload.description),
      kpi('حالة السداد', statusLabel),
      kpi('المبلغ تفقيطاً', words(total, ctx)),
    ].filter((item) => item.value !== '—' || ['المستأجر', 'العقار / الوحدة'].includes(item.label)),
    tables: [TableGenerator.build(['البيان / تفاصيل الخدمات', 'المبلغ'], rows, ['إجمالي المستحق السداد', money(total, ctx)])],
    footer: buildFooter(entry, payload.reference ? `فاتورة رقم: ${payload.reference}` : 'فاتورة مطالبة مالية'),
    fileName: buildDocumentFileName(entry, { reference: payload.reference, dueDate: payload.dueDate }),
  };
}

function buildReceiptModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: ReceiptDocumentPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  const methodLabel = payload.paymentMethod ? PAYMENT_METHOD_LABELS[payload.paymentMethod] ?? payload.paymentMethod : null;
  const purpose = payload.notes?.trim() || (payload.invoiceReference ? `سداد الفاتورة رقم ${payload.invoiceReference}` : 'سداد دفعة مستحقة');

  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: 'إيصال استلام نقدية / سداد',
      reference: payload.reference,
      dateLabel: 'تاريخ الاستلام',
      dateValue: formatDate(payload.paymentDate),
      ctx,
    }),
    kpis: [
      kpi('استلمنا من الفاضل / الفاضلة', payload.payerName || 'غير محدد'),
      kpi('العقار والوحدة', joinPropertyUnit(payload.propertyTitle, payload.unitNumber)),
      kpi('طريقة السداد', methodLabel),
      kpi('رقم المرجع / الشيك', payload.paymentReference),
      ...(payload.collectorName ? [kpi('مستلم المبلغ', payload.collectorName)] : []),
    ],
    tables: [
      TableGenerator.build(
        ['البند والبيان', 'المبلغ بالتفصيل'],
        [
          ['المبلغ المستلم رقماً', money(payload.amount, ctx)],
          ['المبلغ المستلم بالحروف (تفقيط)', words(payload.amount, ctx)],
          ['ذلك عن / مقابل', purpose],
        ],
        ['المبلغ الإجمالي المقبوض', money(payload.amount, ctx)],
      ),
    ],
    footer: buildFooter(entry, payload.reference ? `إيصال استلام رقم: ${payload.reference}` : 'إيصال استلام'),
    fileName: buildDocumentFileName(entry, { reference: payload.reference, paymentDate: payload.paymentDate }),
  };
}

function buildExpenseVoucherModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: ExpenseVoucherPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  const title = payload.kind === 'payment' ? 'سند حركة مالية' : 'سند صرف مصروفات';
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title,
      reference: payload.reference,
      dateLabel: 'تاريخ الصرف',
      dateValue: formatDate(payload.date),
      ctx,
    }),
    kpis: [
      kpi('تصنيف المصروف', payload.category),
      kpi('العقار المرتبط', payload.propertyTitle || 'مصروفات تشغيلية عامة'),
      kpi('تاريخ الصرف', payload.date ? formatDate(payload.date) : null),
    ],
    tables: [
      TableGenerator.build(
        ['بيان المصروف', 'القيمة المالية'],
        [
          ['المبلغ المصروف', money(payload.amount, ctx)],
          ['المبلغ بالحروف', words(payload.amount, ctx)],
          ['شرح وتفاصيل المصروف', payload.description?.trim() || '—'],
        ],
      ),
    ],
    footer: buildFooter(entry, payload.reference ? `${title} رقم: ${payload.reference}` : title),
    fileName: buildDocumentFileName(entry, { reference: payload.reference, date: payload.date }),
  };
}

function buildOwnerStatementModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: OwnerStatementPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: `كشف حساب مالك - ${payload.ownerName}`,
      reference: null,
      dateLabel: 'فترة الكشف',
      dateValue: `${formatDate(payload.periodFrom)} - ${formatDate(payload.periodTo)}`,
      ctx,
    }),
    kpis: [
      kpi('اسم المالك', payload.ownerName),
      kpi('العقار', payload.propertyTitle),
      kpi('إجمالي الإيجارات', money(payload.totalRent, ctx)),
      kpi('إجمالي المصروفات', money(payload.totalExpenses, ctx)),
      kpi('عمولة إدارة الأملاك', money(payload.totalCommission, ctx)),
      kpi('صافي المستحق للمالك', money(payload.netAmount, ctx)),
      kpi('صافي المستحق تفقيطاً', words(payload.netAmount, ctx)),
    ],
    tables: [
      {
        title: 'سجل الحركة المالية للفترة المحددة',
        columns: ['التاريخ', 'نوع الحركة', 'البيان / التفاصيل', 'المبلغ'],
        rows: payload.transactions.map((tx) => [tx.date, tx.type, tx.description, money(tx.amount, ctx)]),
        totals: ['صافي الرصيد المستحق', '', '', money(payload.netAmount, ctx)],
        ...(payload.transactions.length === 0 && entry.emptyState.message ? { emptyNote: entry.emptyState.message } : {}),
      } satisfies DocumentTable,
    ],
    footer: buildFooter(entry, `كشف حساب مالك: ${payload.ownerName}`),
    fileName: buildDocumentFileName(entry, { ownerName: payload.ownerName, periodTo: payload.periodTo }),
  };
}

function buildTenantStatementModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: TenantStatementPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: `كشف حساب مستأجر - ${payload.tenantName}`,
      reference: null,
      dateLabel: 'فترة الكشف',
      dateValue: `${formatDate(payload.periodFrom)} - ${formatDate(payload.periodTo)}`,
      ctx,
    }),
    kpis: [
      kpi('اسم المستأجر', payload.tenantName),
      kpi('العقار والوحدة', joinPropertyUnit(payload.propertyTitle, payload.unitNumber)),
      kpi('الرصيد الافتتاحي', money(payload.openingBalance, ctx)),
      kpi('إجمالي الفواتير والمطالبات', money(payload.totalInvoiced, ctx)),
      kpi('إجمالي السدادات والمقبوضات', money(payload.totalPaid, ctx)),
      kpi('الرصيد المتبقي النهائي', money(payload.closingBalance, ctx)),
      kpi('الرصيد تفقيطاً', words(Math.abs(payload.closingBalance), ctx)),
    ],
    tables: [
      {
        title: 'دفتر حركة حساب المستأجر والذمم الجارية',
        columns: ['التاريخ', 'النوع', 'البيان', 'مدين (مطالبة)', 'دائن (سداد)', 'الرصيد الجاري'],
        rows: payload.lines.map((line) => [
          line.date,
          line.type,
          line.description,
          money(line.debit, ctx),
          money(line.credit, ctx),
          money(line.balance, ctx),
        ]),
        totals: ['إجمالي الرصيد المستحق الواجب السداد', '', '', '', '', money(payload.closingBalance, ctx)],
        ...(payload.lines.length === 0 && entry.emptyState.message ? { emptyNote: entry.emptyState.message } : {}),
      } satisfies DocumentTable,
    ],
    footer: buildFooter(entry, `كشف حساب مستأجر: ${payload.tenantName}`),
    fileName: buildDocumentFileName(entry, { tenantName: payload.tenantName, periodTo: payload.periodTo }),
  };
}

const BALANCE_EPSILON = 0.0005;

function buildTrialBalanceModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: TrialBalanceReportPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  const balanced = Math.abs(payload.totalDebit - payload.totalCredit) < BALANCE_EPSILON;
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: 'ميزان المراجعة',
      reference: null,
      dateLabel: 'كما في',
      dateValue: formatDate(payload.asOf),
      ctx,
    }),
    kpis: [
      kpi('إجمالي المدين', money(payload.totalDebit, ctx)),
      kpi('إجمالي الدائن', money(payload.totalCredit, ctx)),
      kpi('حالة التوازن المحاسبي', balanced ? 'متوازن' : 'غير متوازن'),
    ],
    tables: [
      TableGenerator.build(
        ['رقم الحساب', 'اسم الحساب', 'طبيعة الرصيد', 'مدين', 'دائن'],
        payload.lines.map((line) => [
          line.no,
          line.name,
          line.debit > 0 ? 'مدين' : line.credit > 0 ? 'دائن' : '—',
          line.debit > 0 ? money(line.debit, ctx) : '—',
          line.credit > 0 ? money(line.credit, ctx) : '—',
        ]),
        ['الإجمالي', '', '', money(payload.totalDebit, ctx), money(payload.totalCredit, ctx)],
      ),
    ],
    footer: buildFooter(entry, payload.asOf ? `ميزان المراجعة كما في ${payload.asOf}` : 'ميزان المراجعة'),
    fileName: buildDocumentFileName(entry, { asOf: payload.asOf }),
  };
}

const moneyRowTable = (title: string, rows: MoneyRow[], totalLabel: string, total: number, ctx: FormatContext): DocumentTable => ({
  title,
  columns: ['البند', `المبلغ (${ctx.symbol})`],
  rows: rows.map((row) => [row.label, money(row.amount, ctx)]),
  totals: [totalLabel, money(total, ctx)],
});

function buildIncomeStatementModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: IncomeStatementReportPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  const periodLabel = payload.dateRangeLabel ?? `${formatDate(payload.periodFrom)} - ${formatDate(payload.periodTo)}`;
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: 'قائمة الدخل',
      reference: null,
      dateLabel: 'فترة التقرير',
      dateValue: periodLabel,
      ctx,
    }),
    kpis: [
      kpi('إجمالي الإيرادات', money(payload.totalRevenue, ctx)),
      kpi('إجمالي المصروفات', money(payload.totalExpense, ctx)),
      kpi('صافي الدخل', money(payload.netIncome, ctx)),
    ],
    tables: [
      moneyRowTable('الإيرادات', payload.revenues, 'إجمالي الإيرادات', payload.totalRevenue, ctx),
      moneyRowTable('المصروفات', payload.expenses, 'إجمالي المصروفات', payload.totalExpense, ctx),
      {
        title: 'صافي النتيجة',
        columns: ['البيان', `المبلغ (${ctx.symbol})`],
        rows: [['صافي الدخل / الخسارة', money(payload.netIncome, ctx)]],
      },
    ],
    footer: buildFooter(
      entry,
      payload.periodFrom || payload.periodTo ? `قائمة الدخل للفترة ${payload.periodFrom ?? '—'} إلى ${payload.periodTo ?? '—'}` : 'تقرير قائمة الدخل والربحية',
    ),
    fileName: buildDocumentFileName(entry, { dateRangeLabel: payload.dateRangeLabel, periodTo: payload.periodTo }),
  };
}

function buildBalanceSheetModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: BalanceSheetReportPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: 'قائمة المركز المالي',
      reference: null,
      dateLabel: 'كما في',
      dateValue: formatDate(payload.asOf),
      ctx,
    }),
    kpis: [
      kpi('إجمالي الأصول', money(payload.totalAssets, ctx)),
      kpi('إجمالي الالتزامات', money(payload.totalLiabilities, ctx)),
      kpi('حقوق الملكية', money(payload.totalEquity, ctx)),
    ],
    tables: [
      moneyRowTable('الأصول', payload.assets, 'إجمالي الأصول', payload.totalAssets, ctx),
      moneyRowTable('الالتزامات', payload.liabilities, 'إجمالي الالتزامات', payload.totalLiabilities, ctx),
      moneyRowTable('حقوق الملكية', payload.equity, 'إجمالي حقوق الملكية', payload.totalEquity, ctx),
    ],
    footer: buildFooter(entry, payload.asOf ? `قائمة المركز المالي كما في ${payload.asOf}` : 'قائمة المركز المالي والميزانية العمومية'),
    fileName: buildDocumentFileName(entry, { asOf: payload.asOf }),
  };
}

function buildGenericReportModel(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: GenericReportPayload): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: payload.reportTitle,
      reference: null,
      dateLabel: 'فترة التقرير',
      dateValue: `${formatDate(payload.periodFrom)} - ${formatDate(payload.periodTo)}`,
      ctx,
    }),
    kpis: payload.totalSummary ? [kpi('الملخص المالي والتشغيلي', payload.totalSummary)] : [],
    tables: payload.sections.map((section) => ({
      title: section.title,
      columns: section.columns ?? ['البيان', 'النتيجة / القيمة'],
      rows: section.rows,
      totals: section.totals,
      ...(section.rows.length === 0 && entry.emptyState.message ? { emptyNote: entry.emptyState.message } : {}),
    })),
    footer: buildFooter(entry, payload.reportTitle),
    fileName: buildDocumentFileName(entry, { reportType: payload.reportType, periodTo: payload.periodTo }),
  };
}

const builders: { [T in DocumentTypeId]: (entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: CanonicalDocumentPayloadMap[T]) => UnifiedDocumentModel } = {
  contract: buildContractModel,
  invoice: buildInvoiceModel,
  receipt: buildReceiptModel,
  expense_voucher: buildExpenseVoucherModel,
  payment: buildExpenseVoucherModel,
  owner_statement: buildOwnerStatementModel,
  tenant_statement: buildTenantStatementModel,
  trial_balance: buildTrialBalanceModel,
  income_statement: buildIncomeStatementModel,
  balance_sheet: buildBalanceSheetModel,
  generic_report: buildGenericReportModel,
};

/* ------------------------------------------------------------------ */
/* Engine                                                               */
/* ------------------------------------------------------------------ */

class DocumentEngine {
  /**
   * Canonical typed build. Validates the payload against the registry,
   * asserts a real company identity, drops any non-truthful business
   * reference (defense in depth — adapters already drop UUID fragments),
   * then produces the document model.
   */
  buildDocument<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): UnifiedDocumentModel {
    const entry = requireDocumentTemplateEntry(type);
    const settings = assertDocumentCompanySettings(input.settings);
    validatePayload(entry, input.payload as unknown as Readonly<Record<string, unknown>>);

    let payload = input.payload as CanonicalDocumentPayloadMap[T];
    const referenceField = entry.businessReference.field;
    const rawReference = (payload as Readonly<Record<string, unknown>>)[referenceField];
    if (typeof rawReference === 'string' && rawReference.trim()) {
      const honest = deriveHonestReference(rawReference);
      if (honest !== rawReference.trim()) {
        const patched: Record<string, unknown> = { ...(payload as Readonly<Record<string, unknown>>) };
        patched[referenceField] = honest;
        payload = patched as CanonicalDocumentPayloadMap[T];
      }
    }
    if (
      entry.businessReference.absentBehavior === 'block'
      && !((payload as Readonly<Record<string, unknown>>)[referenceField] as string | null)?.trim()
    ) {
      throw new DocumentDataError('لا يمكن إصدار هذا المستند بدون رقم مرجعي مسجل.');
    }

    return builders[type](entry, settings, payload);
  }

  /**
   * Compatibility build for the historical `{ type, payload }` contract
   * (payloads bundling raw rows + `db`). Normalizes via the legacy
   * adapters, then runs the exact same canonical path.
   */
  build(request: DocumentRequest): UnifiedDocumentModel {
    const payload = request.payload as Record<string, unknown> & { db?: LegacyAppLikeDb };
    const db = payload?.db;
    if (!db?.settings) {
      throw new DocumentDataError('بنية بيانات المستند غير مدعومة.');
    }
    const settings = assertDocumentCompanySettings(legacySettingsToCanonical(db.settings));

    switch (request.type) {
      case 'invoice':
        return this.buildDocument('invoice', { settings, payload: legacyInvoiceToCanonical({ invoice: payload.invoice as Invoice, db }) });
      case 'contract':
        return this.buildDocument('contract', { settings, payload: legacyContractToCanonical({ contract: payload.contract as Contract, db }) });
      case 'receipt':
        return this.buildDocument('receipt', { settings, payload: legacyReceiptToCanonical({ receipt: payload.receipt as Receipt, db }) });
      case 'expense_voucher':
        return this.buildDocument('expense_voucher', { settings, payload: legacyExpenseToCanonical({ expense: payload.expense as Expense, db, kind: 'expense' }) });
      case 'payment':
        return this.buildDocument('payment', { settings, payload: legacyExpenseToCanonical({ expense: payload.expense as Expense, db, kind: 'payment' }) });
      case 'owner_statement':
        return this.buildDocument('owner_statement', { settings, payload: legacyOwnerStatementToCanonical(payload as unknown as { data: LegacyOwnerStatementPayload }) });
      case 'tenant_statement':
        return this.buildDocument('tenant_statement', { settings, payload: legacyTenantStatementToCanonical(payload as unknown as { data: LegacyTenantStatementPayload }) });
      case 'trial_balance':
        return this.buildDocument('trial_balance', { settings, payload: legacyTrialBalanceToCanonical(payload as unknown as LegacyTrialBalancePayload) });
      case 'income_statement':
        return this.buildDocument('income_statement', { settings, payload: legacyIncomeStatementToCanonical(payload as unknown as LegacyIncomeStatementPayload) });
      case 'balance_sheet':
        return this.buildDocument('balance_sheet', { settings, payload: legacyBalanceSheetToCanonical(payload as unknown as LegacyBalanceSheetPayload) });
      case 'generic_report':
        return this.buildDocument('generic_report', { settings, payload: payload as unknown as GenericReportPayload });
      default:
        throw new Error(`Unsupported document type: ${request.type}`);
    }
  }

  /** Registry-driven support check used by the service boundary. */
  supports(type: string): boolean {
    return getDocumentTemplateEntry(type) != null;
  }
}

export const documentEngine = new DocumentEngine();
