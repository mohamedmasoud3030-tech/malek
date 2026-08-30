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
  /**
   * Fraction digits are DERIVED from the real currency code at render time
   * (`currencyFractionDigits` — OMR/KWD/BHD ⇒ 3, common currencies ⇒ 2,
   * zero-decimal currencies ⇒ 0). The registry never fixes a global
   * precision; hard-coding 3 decimals would misformat USD/EGP/… amounts.
   */
  precision: 'currency-derived';
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

const CURRENCY_POLICY: CurrencyPolicy = { source: 'company-settings', precision: 'currency-derived' };

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
  {
    type: 'owner_report',
    templateId: 'owner-report-professional-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['reportTitle', 'ownerName', 'identity', 'groups'],
    optionalData: ['reportType', 'periodFrom', 'periodTo', 'generatedAt', 'scopeLabel', 'propertyTitle'],
    businessReference: { field: 'ownerName', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render', message: 'لا توجد بيانات كشف مالك معتمدة للفترة المحددة.' },
    fileName: { strategy: 'reference-then-date', prefix: 'owner-report', dateField: 'periodTo', maxLength: 80 },
    notes: 'كشف المالك التفصيلي: حزمة تقرير مالية احترافية مبنية حصراً على سلطات القراءة المعتمدة (rpt_owner_statement / rpt_owner_financial_position / التسويات). لا يعيد احتساب التسوية داخل محرك المستند.',  
  },
  {
    type: 'property_report',
    templateId: 'property-report-professional-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['reportTitle', 'identity', 'groups'],
    optionalData: ['reportType', 'periodFrom', 'periodTo', 'generatedAt', 'scopeLabel', 'propertyTitle'],
    businessReference: { field: 'propertyTitle', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render', message: 'لا توجد بيانات أداء معتمدة للعقار والفترة المحددة.' },
    fileName: { strategy: 'reference-then-date', prefix: 'property-report', dateField: 'periodTo', maxLength: 80 },
    notes: 'تقرير أداء العقار: صفحة تنفيذية + مقارنة بالفترة السابقة + مخططات مطبوعة + طاولة أداء الوحدات + ملخص مخاطر نهائي. الأرقام من نماذج القراءة المعتمدة دون إعادة احتساب.',
  },
  {
    type: 'unit_inspection',
    templateId: 'unit-inspection-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['inspectionDate', 'inspectionMode', 'conditionRows'],
    optionalData: ['reference', 'propertyTitle', 'unitNumber', 'tenantName', 'meterReadings', 'keyHandover', 'evidenceRefs', 'notes', 'inspectorName'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      move_in: 'محضر فحص واستلام وحدة (دخول)',
      move_out: 'محضر فحص وتسليم وحدة (إخلاء)',
      inspection: 'محضر معاينة دورية لوحدة',
    },
    defaultStatusLabel: 'محضر فحص ومعاينة وحدة عقارية',
    signatureRoles: ['inspector', 'tenant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'block', message: 'لا يمكن إصدار محضر الفحص بدون بنود المعاينة.' },
    fileName: { strategy: 'reference-then-date', prefix: 'unit-inspection', dateField: 'inspectionDate', maxLength: 80 },
    notes: 'محضر فحص ومعاينة الوحدة عند الدخول أو الإخلاء أو الجولات الدورية.',
  },
  {
    type: 'lease_notice',
    templateId: 'lease-notice-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['noticeDate', 'noticeKind'],
    optionalData: ['reference', 'tenantName', 'propertyTitle', 'unitNumber', 'currentEndDate', 'effectiveDate', 'approvedMessage', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      renewal: 'إشعار تجديد عقد إيجار',
      vacate: 'إشعار إخلاء وحدة عقارية',
      non_renewal: 'إشعار عدم رغبة في التجديد',
    },
    defaultStatusLabel: 'إشعار عقاري رسمي',
    signatureRoles: ['general_manager', 'tenant'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'lease-notice', dateField: 'noticeDate', maxLength: 80 },
    notes: 'إشعار عقاري رسمي لتجديد العقد أو الإخلاء أو عدم التجديد بناءً على قرار مسجل.',
  },
  {
    type: 'deposit_voucher',
    templateId: 'deposit-voucher-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['transactionDate', 'transactionKind', 'amount'],
    optionalData: ['reference', 'tenantName', 'propertyTitle', 'unitNumber', 'depositBalance', 'reason', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      received: 'سند استلام مبلغ تأمين',
      returned: 'سند رد مبلغ تأمين',
      deducted: 'سند تسوية وخصم من التأمين',
    },
    defaultStatusLabel: 'سند تأمين عقاري',
    signatureRoles: ['accountant', 'tenant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'deposit-voucher', dateField: 'transactionDate', maxLength: 80 },
    notes: 'سند حركة مبلغ تأمين (قبض/رد/خصم)؛ مستقل عن الإيرادات والمصروفات التشغيلية.',
  },
  {
    type: 'debt_rescheduling',
    templateId: 'debt-rescheduling-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['agreementDate', 'debtAmount', 'installments'],
    optionalData: ['reference', 'tenantName', 'contractReference', 'propertyTitle', 'unitNumber', 'effectiveDate', 'status', 'terms', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      draft: 'مسودة اتفاقية جدولة',
      active: 'اتفاقية جدولة سارية المفعول',
      completed: 'اتفاقية جدولة مسددة بالكامل',
      defaulted: 'اتفاقية جدولة متعثرة',
    },
    defaultStatusLabel: 'اتفاقية إعادة جدولة مديونية',
    signatureRoles: ['tenant', 'accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'block', message: 'لا يمكن إصدار اتفاقية الجدولة بدون جدول أقساط معتمد.' },
    fileName: { strategy: 'reference-then-date', prefix: 'debt-rescheduling', dateField: 'agreementDate', maxLength: 80 },
    notes: 'اتفاقية إعادة جدولة مديونية قائمة؛ الأقساط والمبالغ مدخلة من السلطة المعتمدة دون احتساب تلقائي.',
  },
  {
    type: 'tenant_clearance',
    templateId: 'tenant-clearance-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['clearanceDate', 'clearanceStatus'],
    optionalData: ['reference', 'tenantName', 'propertyTitle', 'unitNumber', 'outstandingAmount', 'depositDisposition', 'depositAmount', 'maintenanceNotes', 'utilityNotes', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      cleared: 'براءة ذمة ومخالصة نهائية تامة',
      outstanding: 'مخالصة مشروطة مع وجود مستحقات معلقة',
      pending: 'مخالصة قيد الإجراء والتدقيق',
    },
    defaultStatusLabel: 'شهادة مخالصة مستأجر',
    signatureRoles: ['accountant', 'general_manager', 'tenant'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'tenant-clearance', dateField: 'clearanceDate', maxLength: 80 },
    notes: 'مخالصة المستأجر وبراءة الذمة؛ تمتنع الوثيقة عن النص على براءة الذمة إلا إذا أثبتت البيانات المرجعية ذلك.',
  },
  {
    type: 'owner_settlement',
    templateId: 'owner-settlement-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['ownerName', 'collectedOwnerFunds', 'managementFee', 'ownerExpenses', 'netDue', 'status', 'supportingRows'],
    optionalData: ['reference', 'periodFrom', 'periodTo', 'propertyTitle', 'payoutReference', 'payoutDate', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      pending: 'كشف تسوية مالك (بانتظار الاعتماد)',
      approved: 'كشف تسوية مالك معتمد للصرف',
      paid: 'كشف تسوية مالك مصروف ومسدد',
      cancelled: 'كشف تسوية مالك ملغي',
    },
    defaultStatusLabel: 'كشف تسوية مستحقات المالك',
    signatureRoles: ['accountant', 'general_manager', 'owner'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'owner-settlement', dateField: 'periodTo', maxLength: 80 },
    notes: 'كشف تسوية وصرف مستحقات المالك؛ المبالغ والأتعاب والصافي مستلمة مباشرة من دورة التسوية دون إعادة احتساب.',
  },
  {
    type: 'management_exit',
    templateId: 'management-exit-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['exitDate'],
    optionalData: ['reference', 'propertyTitle', 'ownerName', 'agreementEndDate', 'status', 'keysHandover', 'documentsHandover', 'outstandingSettlementNote', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      completed: 'محضر تسليم وإنهاء إدارة منجز',
      draft: 'مسودة محضر إنهاء إدارة',
    },
    defaultStatusLabel: 'محضر إنهاء إدارة وتسليم عقار',
    signatureRoles: ['owner', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'management-exit', dateField: 'exitDate', maxLength: 80 },
    notes: 'محضر إنهاء إدارة العقار وتسليم العهد والوثائق؛ لا يدّعي تسوية مالية نهائية مالم تدعمها البيانات المرجعية.',
  },
  {
    type: 'unit_passport',
    templateId: 'unit-passport-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['currentStatus', 'leaseHistory', 'maintenanceHistory'],
    optionalData: ['propertyTitle', 'unitNumber', 'unitType', 'utilitySummary', 'financialSummaryNote', 'notes'],
    businessReference: { field: 'unitNumber', absentBehavior: 'omit', displayAsDocumentNo: false },
    statusLabels: {},
    defaultStatusLabel: 'جواز الوحدة العقارية',
    signatureRoles: ['general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'unit-passport', dateField: 'currentStatus', maxLength: 80 },
    notes: 'جواز الوحدة وسجل دورة حياتها التشغيلية والإيجارية؛ وثيقة استعراض تاريخي ولا تمثل سلطة رصيد مالي جديدة.',
  },
  {
    type: 'maintenance_work_order',
    templateId: 'maintenance-work-order-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['issueDate', 'status', 'title'],
    optionalData: ['reference', 'scheduledDate', 'propertyTitle', 'unitNumber', 'description', 'category', 'priority', 'assignedProvider', 'technicianName', 'responsibleParty', 'approvedEstimate', 'instructions', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      pending: 'أمر عمل صيانة (قيد الانتظار)',
      in_progress: 'أمر عمل صيانة (قيد التنفيذ)',
      completed: 'أمر عمل صيانة (مكتمل)',
      cancelled: 'أمر عمل صيانة (ملغي)',
    },
    defaultStatusLabel: 'أمر عمل صيانة',
    signatureRoles: ['general_manager', 'vendor'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'work-order', dateField: 'issueDate', maxLength: 80 },
    notes: 'أمر تكليف بتنفيذ أعمال صيانة لمزود الخدمة أو الفني؛ لا يُحدث تغييراً في الحالة بمجرد الطباعة.',
  },
  {
    type: 'maintenance_completion',
    templateId: 'maintenance-completion-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['completionDate', 'status', 'title'],
    optionalData: ['reference', 'propertyTitle', 'unitNumber', 'workPerformed', 'providerName', 'approvedFinalCost', 'evidenceRefs', 'tenantAccepted', 'managerAccepted', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {
      completed: 'شهادة إنجاز واستلام أعمال صيانة مكتملة',
      in_progress: 'تقرير متابعة أعمال صيانة قيد التنفيذ',
    },
    defaultStatusLabel: 'شهادة إنجاز أعمال صيانة',
    signatureRoles: ['vendor', 'tenant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'render' },
    fileName: { strategy: 'reference-then-date', prefix: 'maintenance-completion', dateField: 'completionDate', maxLength: 80 },
    notes: 'شهادة إنجاز واستلام الصيانة بعد التنفيذ الفعلي والتكلفة المعتمدة؛ لا توصف بالمكتملة مالم تثبت بياناتها ذلك.',
  },
  {
    type: 'legal_dossier',
    templateId: 'legal-dossier-a4-ar',
    templateVersion: 1,
    supportedOutputs: OUTPUTS,
    requiredData: ['timelineEvents'],
    optionalData: ['reference', 'contractReference', 'tenantName', 'propertyTitle', 'unitNumber', 'unpaidInvoiceRefs', 'totalArrearsAmount', 'noticeRefs', 'caseStatus', 'notes'],
    businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
    statusLabels: {},
    defaultStatusLabel: 'ملف الأدلة والمستندات القانونية',
    signatureRoles: ['accountant', 'general_manager'],
    page: A4_PORTRAIT,
    currency: CURRENCY_POLICY,
    emptyState: { behavior: 'block', message: 'لا يمكن إصدار ملف النزاع القانوني بدون أحداث تسلسل زمني موثقة.' },
    fileName: { strategy: 'reference-then-date', prefix: 'legal-dossier', maxLength: 80 },
    notes: 'ملف تجميعي للقضايا والنزاعات الإيجارية مبني على سجلات ووقائع فعلية دون استنتاجات قانونية مصطنعة.',
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
 * Linear-time edge trim for `-`/`.` separators. Implemented without a
 * regex so hostile filename input can never trigger regex backtracking.
 */
const trimEdgeSeparators = (text: string): string => {
  const isSeparator = (char: string | undefined): boolean => char === '-' || char === '.';
  let start = 0;
  let end = text.length;
  while (start < end && isSeparator(text[start])) start += 1;
  while (end > start && isSeparator(text[end - 1])) end -= 1;
  return text.slice(start, end);
};

/**
 * Linear-time removal of `..` dot runs (path traversal) without a quantified
 * regex, for the same backtracking-resistance reason.
 */
const stripDotRuns = (text: string): string => {
  let result = '';
  let index = 0;
  while (index < text.length) {
    if (text[index] === '.') {
      let runEnd = index;
      while (runEnd < text.length && text[runEnd] === '.') runEnd += 1;
      if (runEnd - index === 1) result += '.';
      index = runEnd;
      continue;
    }
    result += text[index];
    index += 1;
  }
  return result;
};

/**
 * Produces a safe, readable, deterministic download filename:
 * strips path-unsafe characters and path traversal, converts whitespace to
 * single dashes, collapses separators, caps length, and guarantees a
 * non-empty fallback. Arabic letters are preserved (valid filenames on all
 * supported platforms).
 */
export function sanitizeDocumentFileName(value: string, fallback = 'document', maxLength = 96): string {
  const cleaned = trimEdgeSeparators(
    stripDotRuns(value)
      .replace(UNSAFE_FILENAME_CHARS, '-')
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .trim(),
  );

  const capped = cleaned.length > maxLength ? trimEdgeSeparators(cleaned.slice(0, maxLength)) : cleaned;
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
  return sanitizeDocumentFileName(raw, entry.fileName.prefix, entry.fileName.maxLength);
}
