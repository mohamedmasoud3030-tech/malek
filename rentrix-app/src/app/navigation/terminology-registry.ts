/**
 * Canonical Arabic terminology for navigation and workspace surfaces.
 * Visible navigation must never fall back to English merely because a company
 * locale is configured as English; the current MALEK shell is Arabic-first.
 */

/** Canonical Arabic label for every primary/mobile navigation labelKey. */
export const navigationLabels: Readonly<Record<string, string>> = {
  // Task-centric primary IA
  today: 'اليوم',
  portfolio: 'المحفظة',
  leasing: 'التأجير',
  money: 'المال',

  // Route/entity terminology kept for secondary workspaces and compatibility
  dashboard: 'لوحة التحكم',
  properties: 'العقارات',
  owners: 'الملاك',
  tenants: 'المستأجرون',
  contracts: 'العقود',
  services: 'الخدمات',
  maintenance: 'الصيانة',
  serviceProviders: 'مزودو الخدمات',
  financials: 'المالية',
  financialOverview: 'المالية',
  accountingReports: 'المحاسبة والتقارير',
  reports: 'المحاسبة والتقارير',
  reportsAndStatements: 'التقارير والكشوف',
  aiAssistant: 'المساعد الذكي',
  settings: 'الإعدادات',
  companySettings: 'الشركة',
  usersPermissions: 'المستخدمون والصلاحيات',
  costCenters: 'مراكز التكلفة',
  systemSettings: 'إعدادات النظام',
  peopleDirectory: 'جهات التعامل',
  units: 'الوحدات',
  lands: 'الأراضي',
  commissions: 'العمولات',
  leads: 'العملاء المحتملون',
  communication: 'التواصل والمتابعات',
  utilities: 'المرافق',
  automation: 'الأتمتة',
  documentsVault: 'خزينة المستندات',
  changePassword: 'تغيير كلمة المرور',
  auditLog: 'سجل التدقيق',
  dataIntegrity: 'سلامة البيانات',
  system: 'إدارة النظام',
  newContract: 'عقد جديد',
  newProperty: 'عقار جديد',
  newPerson: 'شخص جديد',
};

/** Canonical Arabic workspace label for secondary items. */
export const workspaceLabels: Record<string, string> = {
  owners: 'الملاك',
  units: 'الوحدات',
  lands: 'الأراضي',
  people: 'جهات التعامل',
  tenants: 'المستأجرون',
  leads: 'العملاء المحتملون',
  communication: 'التواصل والمتابعات',
  service_providers: 'مزودو الخدمات',
  utilities: 'المرافق',
  automation: 'الأتمتة',
  documents_vault: 'خزينة المستندات',
  invoices: 'الفواتير',
  receipts: 'الإيصالات',
  expenses: 'المصروفات',
  arrears: 'المتأخرات',
  deposits: 'التأمينات',
  owner_settlements: 'تسويات الملاك',
  bank_reconciliation: 'المطابقة البنكية',
  commissions: 'العمولات',
  aiAssistant: 'المساعد الذكي',
  changePassword: 'تغيير كلمة المرور',
  auditLog: 'سجل التدقيق',
  dataIntegrity: 'سلامة البيانات',
  system: 'إدارة النظام',
};

// NOTE: A legacy `hubPageTitles` map (entity-centric page titles such as
// «لوحة التحكم»/«التشغيل والصيانة») and a redundant `canonicalTerms` map
// were removed here. They were orphan (zero consumers) and contradicted the
// active task-centric `navigationLabels` used by the sidebar and hub page
// headers (اليوم/المحفظة/التأجير/المال/الخدمات/التقارير والكشوف).
// Single source of truth for visible naming is `navigationLabels` +
// `workspaceLabels` below.
