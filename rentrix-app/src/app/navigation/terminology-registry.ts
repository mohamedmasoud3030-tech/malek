/**
 * Canonical terminology registry for the application.
 *
 * UX-018 / UX-019: Resolves inconsistent visible terminology across:
 *  - sidebar navigation
 *  - mobile navigation
 *  - breadcrumbs
 *  - page H1 headings
 *  - tab labels
 *  - action labels
 *
 * Every user-facing term must source from this registry to prevent the
 * documented inconsistencies (المصاريف vs المصروفات, etc.).
 */

/** Canonical Arabic workspace label for each navigation child item. */
export const workspaceLabels: Record<string, string> = {
  // Portfolio children
  owners: 'الملاك',
  units: 'الوحدات',
  lands: 'الأراضي',

  // Relationships / Contracts children
  people: 'جهات التعامل',
  tenants: 'المستأجرون',
  leads: 'العملاء المحتملون',
  communication: 'التواصل والمتابعات',

  // Operations children
  utilities: 'المرافق',
  automation: 'الأتمتة',
  documents_vault: 'خزينة المستندات',

  // Finance children
  invoices: 'الفواتير',
  receipts: 'الإيصالات',
  expenses: 'المصروفات',
  arrears: 'المتأخرات',
  deposits: 'التأمينات',
  owner_settlements: 'تسويات الملاك',
  bank_reconciliation: 'المطابقة البنكية',
  commissions: 'العمولات',

  // Reports children
  aiAssistant: 'المساعد الذكي',

  // Settings children
  changePassword: 'تغيير كلمة المرور',
  auditLog: 'سجل التدقيق',
  dataIntegrity: 'سلامة البيانات',
  system: 'إدارة النظام',
};

/**
 * Canonical H1 / page-title labels for top-level hubs.
 * These resolve the terminology drift documented across finance, reports,
 * and governance destinations.
 */
export const hubPageTitles: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/properties': 'المحفظة العقارية',
  '/properties/new': 'إضافة عقار',
  '/properties/$propertyId': 'تفاصيل العقار',
  '/properties/$propertyId/edit': 'تعديل عقار',
  '/contracts': 'العقود',
  '/contracts/new': 'إنشاء عقد',
  '/contracts/$contractId': 'تفاصيل العقد',
  '/contracts/$contractId/edit': 'تعديل عقد',
  '/maintenance': 'الصيانة',
  '/financials': 'المالية',
  '/invoices': 'الفواتير',
  '/receipts': 'الإيصالات',
  '/expenses': 'المصروفات',
  '/arrears': 'المتأخرات',
  '/deposits': 'التأمينات',
  '/owner-settlements': 'تسويات الملاك',
  '/bank-reconciliation': 'المطابقة البنكية',
  '/commissions': 'العمولات',
  '/reports': 'التقارير',
  '/settings': 'الإدارة والحوكمة',
  '/ai-assistant': 'المساعد الذكي',
  '/people': 'جهات التعامل',
  '/tenants': 'المستأجرون',
  '/leads': 'العملاء المحتملون',
  '/communication': 'التواصل والمتابعات',
  '/utilities': 'المرافق',
  '/automation': 'الأتمتة',
  '/documents-vault': 'خزينة المستندات',
  '/owners': 'الملاك',
  '/units': 'الوحدات',
  '/lands': 'الأراضي',
  '/change-password': 'تغيير كلمة المرور',
  '/audit-log': 'سجل التدقيق',
  '/data-integrity': 'سلامة البيانات',
  '/system': 'إدارة النظام',
};

/**
 * Canonical financial terms resolving UX-018/019 terminology drift.
 */
export const canonicalTerms = {
  // المصاريف / المصروفات / المصروفات التشغيلية → المصروفات
  expenses: 'المصروفات',
  // الإيصالات / التحصيل والإيصالات / التحصيلات والإيصالات → الإيصالات
  receipts: 'الإيصالات',
  // المتأخرات / المتأخرات والديون → المتأخرات
  arrears: 'المتأخرات',
  // التأمينات / تأمين وأمانات المستأجرين → التأمينات
  deposits: 'التأمينات',
  // المستأجرين / المستأجرون → المستأجرون
  tenants: 'المستأجرون',
  // الملاك / المالكين → الملاك
  owners: 'الملاك',
  // الفواتير / الفواتير والتحصيلات → الفواتير
  invoices: 'الفواتير',
  // العمولات / عمولات المكتب → العمولات
  commissions: 'العمولات',
  // المطابقة البنكية / التسوية البنكية → المطابقة البنكية
  bankReconciliation: 'المطابقة البنكية',
  // تسويات الملاك / تسوية الملاك → تسويات الملاك
  ownerSettlements: 'تسويات الملاك',
} as const;
