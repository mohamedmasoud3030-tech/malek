import {
  DEFAULT_LANGUAGE,
  getLanguageDirection,
  getLanguageLocale,
  normalizeLanguage,
  type SupportedLanguage,
  type TextDirection,
} from './companySettings';
import { APP_BRAND_NAME } from './brand';

const I18N_NAMESPACE = 'common';

type SharedTranslationResources = Readonly<Record<string, string>>;
type SharedTranslationEntry = readonly [key: string, arabicLabel: string, englishLabel: string];

const sharedTranslationEntries = [
  ['appName', APP_BRAND_NAME, APP_BRAND_NAME],
  ['realEstateManagement', 'إدارة عقارية بوضوح وسرعة', 'Real estate operations with clarity'],
  ['home', 'الرئيسية', 'Home'],
  ['loading', 'جارٍ التحميل...', 'Loading...'],
  ['error', 'حدث خطأ غير متوقع', 'An unexpected error occurred'],
  ['logout', 'تسجيل الخروج', 'Log out'],
  ['logoutSuccess', 'تم تسجيل الخروج بنجاح', 'Logged out successfully'],
  ['pageLoadErrorTitle', 'تعذر تحميل هذه الصفحة', 'This page could not be loaded'],
  [
    'pageLoadErrorDescription',
    'حدث خطأ غير متوقع. أعد المحاولة أو راجع الإعدادات ثم جرّب مرة أخرى.',
    'An unexpected error occurred. Retry or review settings, then try again.',
  ],
  ['retry', 'إعادة المحاولة', 'Retry'],
  ['routeLoadingAria', 'جار التحميل', 'Loading'],
  ['dashboard', 'لوحة التحكم', 'Dashboard'],
  ['properties', 'العقارات', 'Properties'],
  ['units', 'الوحدات', 'Units'],
  ['people', 'الأشخاص', 'People'],
  ['peopleDirectory', 'جهات التعامل', 'People directory'],
  ['tenants', 'المستأجرين', 'Tenants'],
  ['owners', 'الملاك', 'Owners'],
  ['ownersHub', 'مركز الملاك', 'Owners hub'],
  ['lands', 'الأراضي', 'Lands'],
  ['leads', 'العملاء المحتملون', 'Leads'],
  ['commissions', 'العمولات', 'Commissions'],
  ['bankReconciliation', 'مطابقة البنك', 'Bank reconciliation'],
  ['communication', 'التواصل', 'Communication'],
  ['automation', 'الأتمتة', 'Automation'],
  ['contracts', 'العقود', 'Contracts'],
  ['financials', 'المالية', 'Financials'],
  ['financialOverview', 'الملخص المالي', 'Financial overview'],
  ['deposits', 'التأمينات', 'Deposits'],
  ['ownerSettlements', 'تسويات الملاك', 'Owner settlements'],
  ['invoices', 'الفواتير', 'Invoices'],
  ['receipts', 'الإيصالات', 'Receipts'],
  ['collectionsReceipts', 'التحصيلات والإيصالات', 'Collections & receipts'],
  ['expenses', 'المصاريف', 'Expenses'],
  ['arrears', 'المتأخرات', 'Arrears'],
  ['accounting', 'المحاسبة', 'Accounting'],
  ['reports', 'التقارير', 'Reports'],
  ['statements', 'كشوف الحساب', 'Statements'],
  ['reportsAndStatements', 'التقارير والكشوف', 'Reports & statements'],
  ['aiAssistant', 'مساعد الذكاء', 'AI assistant'],
  ['maintenance', 'الصيانة', 'Maintenance'],
  ['system', 'النظام', 'System'],
  ['auditLog', 'سجل التدقيق', 'Audit log'],
  ['dataIntegrity', 'سلامة البيانات', 'Data integrity'],
  ['changePassword', 'تغيير كلمة المرور', 'Change password'],
  ['settings', 'الإعدادات', 'Settings'],
  ['collapseMenu', 'طي القائمة', 'Collapse menu'],
  ['toggleTheme', 'تبديل الوضع', 'Toggle theme'],
  ['notifications', 'الإشعارات', 'Notifications'],
  ['notificationsNone', 'لا توجد إشعارات حالياً', 'No notifications right now'],
  ['notifOverdueInvoices', 'فواتير متأخرة', 'Overdue invoices'],
  ['notifExpiringContracts', 'عقود تنتهي خلال 30 يومًا', 'Contracts expiring within 30 days'],
  ['notifUrgentMaintenance', 'طلبات صيانة عاجلة', 'Urgent maintenance requests'],
  ['notificationsHint', 'ستظهر هنا تنبيهات العقود القريبة من الانتهاء والفواتير المتأخرة.', 'Contract expiry and overdue invoice alerts will appear here.'],
  ['configureAiAssistant', 'ضبط إعدادات الذكاء الاصطناعي', 'Configure AI assistant'],
  ['unsavedChanges', 'تغييرات غير محفوظة', 'Unsaved changes'],
  ['newContract', 'عقد جديد', 'New contract'],
  ['newProperty', 'عقار جديد', 'New property'],
  ['newPerson', 'شخص جديد', 'New person'],
  ['quickAdd', 'إنشاء سريع', 'Quick create'],
  ['exportCsv', 'تصدير CSV', 'Export CSV'],
  ['noResultsHint', 'لا توجد نتائج مطابقة — جرّب كلمات أخرى أو امسح الفلاتر.', 'No matching results — try different words or clear filters.'],
  ['clearFilters', 'مسح الفلاتر', 'Clear filters'],
  ['aiUnavailable', 'المساعد غير مهيأ — راجع الإعدادات', 'Assistant not configured — review settings'],
  ['adminGroup', 'إدارة النظام', 'System administration'],
  ['navUpgradeTitle', 'أقسام حسب الصلاحية', 'Role-based sections'],
  [
    'navUpgradeHint',
    'بعض الأقسام لا تظهر لأن دورك الحالي لا يملك صلاحية الوصول إليها.',
    'Some sections are hidden because your current role cannot access them.',
  ],
  ['ariaCurrentPage', 'الصفحة الحالية', 'Current page'],
  ['skipToContent', 'تخطي إلى المحتوى الرئيسي', 'Skip to main content'],
  ['openMenu', 'فتح القائمة', 'Open menu'],
  ['closeMenu', 'إغلاق القائمة', 'Close menu'],
  ['confirm', 'تأكيد', 'Confirm'],
  ['cancel', 'إلغاء', 'Cancel'],
  // ===== Financial routes UX clarity (ADR-0008) =====
  // Descriptions shown in the PageHeader of /financials and /reports to make
  // the purpose of each page unambiguous and to remove the previous UX overlap
  // between "financials", "financialOverview", and "reports" labels.
  [
    'financialsPageDescription',
    'فهرس شامل للعمليات المالية اليومية. اختر القسم الذي تريد إدارته — الفواتير، التحصيل، المصروفات، تسويات الملاك، وغيرها.',
    'A complete index of day-to-day financial operations. Choose a workspace to manage invoices, collections, expenses, owner settlements, and more.',
  ],
  [
    'financialsPageHint',
    'كل عملية لها صفحتها المستقلة بصلاحياتها الخاصة.',
    'Each workflow has its own page with its own permissions.',
  ],
  [
    'reportsPageDescription',
    'مركز تنفيذي لتحليل البيانات المالية. فلترة متقدمة، تصدير CSV، وعرض تفصيلي لكل تقرير محاسبي وتشغيلي.',
    'An executive analytics center for financial data. Advanced filtering, CSV export, and detailed views for every accounting and operational report.',
  ],
  [
    'reportsPageHint',
    'هنا تحصل على التحليل العميق — للملخص السريع استخدم صفحة المالية.',
    'For deep analysis. For a quick overview, use the Financials page.',
  ],
  [
    'financialsSectionSummary',
    'الملخص السريع',
    'Quick summary',
  ],
  [
    'financialsSectionReports',
    'التقارير التفصيلية',
    'Detailed reports',
  ],
] as const satisfies ReadonlyArray<SharedTranslationEntry>;

function getEntryLabel(entry: SharedTranslationEntry, language: SupportedLanguage): string {
  const [, arabicLabel, englishLabel] = entry;

  return language === 'en' ? englishLabel : arabicLabel;
}

function buildSharedTranslationResources(language: SupportedLanguage): SharedTranslationResources {
  return Object.fromEntries(sharedTranslationEntries.map((entry) => [entry[0], getEntryLabel(entry, language)]));
}

export const i18nResources = {
  ar: { common: buildSharedTranslationResources('ar') },
  en: { common: buildSharedTranslationResources('en') },
} as const satisfies Record<SupportedLanguage, Readonly<Record<typeof I18N_NAMESPACE, SharedTranslationResources>>>;

export type AppLanguageState = Readonly<{
  language: SupportedLanguage;
  locale: string;
  direction: TextDirection;
}>;

export function getAppLanguageState(language: unknown = DEFAULT_LANGUAGE): AppLanguageState {
  const normalizedLanguage = normalizeLanguage(language);

  return {
    language: normalizedLanguage,
    locale: getLanguageLocale(normalizedLanguage),
    direction: getLanguageDirection(normalizedLanguage),
  };
}

export function translateSharedLabel(key: string, language: unknown = DEFAULT_LANGUAGE): string {
  const { language: normalizedLanguage } = getAppLanguageState(language);
  const localizedResources: SharedTranslationResources = i18nResources[normalizedLanguage][I18N_NAMESPACE];
  const fallbackResources: SharedTranslationResources = i18nResources[DEFAULT_LANGUAGE][I18N_NAMESPACE];
  const localizedValue = localizedResources[key];
  const fallbackValue = fallbackResources[key];

  return localizedValue ?? fallbackValue ?? key;
}

export type DocumentLanguageTarget = {
  documentElement: Pick<HTMLElement, 'dir' | 'lang'>;
};

export function applyDocumentLanguageDirection(language: unknown = DEFAULT_LANGUAGE, documentRef: DocumentLanguageTarget = document): AppLanguageState {
  const languageState = getAppLanguageState(language);

  documentRef.documentElement.lang = languageState.locale;
  documentRef.documentElement.dir = languageState.direction;

  return languageState;
}
