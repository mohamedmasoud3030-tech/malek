/**
 * Canonical Arabic terminology for navigation and workspace surfaces.
 * Visible navigation must never fall back to English merely because a company
 * locale is configured as English; the current MALEK shell is Arabic-first.
 */

/** Canonical Arabic label for every primary/mobile navigation labelKey. */
export const navigationLabels: Readonly<Record<string, string>> = {
  // Task-centric primary IA
  today: 'اليوم',
  portfolio: 'العقارات',
  leasing: 'العقود',
  money: 'المال',

  // Route/entity terminology kept for secondary workspaces and compatibility
  dashboard: 'لوحة التحكم',
  properties: 'العقارات',
  owners: 'الملاك',
  tenants: 'المستأجرون',
  contracts: 'العقود',
  services: 'الصيانة',
  maintenance: 'الصيانة',
  serviceProviders: 'مزودو الخدمات',
  financials: 'المالية',
  accountingReports: 'التقارير',
  reports: 'التقارير',
  settings: 'الإعدادات',
  companySettings: 'الشركة',
  usersPermissions: 'المستخدمون والصلاحيات',
  adminSupport: 'عمليات الدعم والتحقيق',
  costCenters: 'مراكز التكلفة',
  systemSettings: 'إعدادات النظام',
  peopleDirectory: 'الأشخاص',
  units: 'الوحدات',
  lands: 'الأراضي',
  commissions: 'العمولات',
  leads: 'العملاء المحتملون',
  communication: 'التواصل',
  utilities: 'المرافق والعدادات',
  automation: 'الأتمتة',
  documentsVault: 'المستندات التشغيلية',
  system: 'إدارة النظام',
  newContract: 'عقد جديد',
  collectPayment: 'تحصيل مبلغ',
  maintenanceRequest: 'طلب صيانة',
  utilityBill: 'فاتورة مرافق',
};

/** Canonical Arabic workspace label for secondary items. */
export const workspaceLabels: Record<string, string> = {
  owners: 'الملاك',
  units: 'الوحدات',
  lands: 'الأراضي',
  people: 'الأشخاص',
  tenants: 'المستأجرون',
  leads: 'العملاء المحتملون',
  communication: 'التواصل',
  service_providers: 'مزودو الخدمات',
  utilities: 'المرافق والعدادات',
  automation: 'الأتمتة',
  documents_vault: 'المستندات التشغيلية',
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
// headers (اليوم/المحفظة/التأجير/المال/الخدمات/التقارير).
// Single source of truth for visible naming is `navigationLabels` +
// `workspaceLabels` below.
