import {
  DEFAULT_LANGUAGE,
  getLanguageDirection,
  getLanguageLocale,
  normalizeLanguage,
  type SupportedLanguage,
  type TextDirection,
} from './companySettings';

const I18N_NAMESPACE = 'common';

type SharedTranslationResources = Readonly<Record<string, string>>;
type SharedTranslationEntry = readonly [key: string, arabicLabel: string, englishLabel: string];

const sharedTranslationEntries = [  ['home', 'الرئيسية', 'Home'],
  ['loading', 'جارٍ التحميل...', 'Loading...'],
  ['error', 'حدث خطأ غير متوقع', 'An unexpected error occurred'],  ['logoutSuccess', 'تم تسجيل الخروج بنجاح', 'Logged out successfully'],
  ['pageLoadErrorTitle', 'تعذر تحميل هذه الصفحة', 'This page could not be loaded'],
  [
    'pageLoadErrorDescription',
    'حدث خطأ غير متوقع. أعد المحاولة أو راجع الإعدادات ثم جرّب مرة أخرى.',
    'An unexpected error occurred. Retry or review settings, then try again.',
  ],
  ['retry', 'إعادة المحاولة', 'Retry'],
  ['dashboard', 'لوحة التحكم', 'Dashboard'],
  ['properties', 'العقارات', 'Properties'],
  ['units', 'الوحدات', 'Units'],
  ['people', 'الأشخاص', 'People'],
  ['peopleDirectory', 'الأشخاص', 'People directory'],
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
  ['financials', 'المالية', 'Financials'],  ['deposits', 'التأمينات', 'Deposits'],
  ['ownerSettlements', 'تسويات الملاك', 'Owner settlements'],
  ['invoices', 'الفواتير', 'Invoices'],
  ['receipts', 'الإيصالات', 'Receipts'],  ['expenses', 'المصروفات', 'Expenses'],
  ['arrears', 'المتأخرات', 'Arrears'],
  ['accounting', 'المحاسبة', 'Accounting'],
  ['reports', 'التقارير', 'Reports'],
  ['statements', 'كشوف الحساب', 'Statements'],  ['maintenance', 'الصيانة', 'Maintenance'],
  ['serviceProviders', 'مزودو الخدمات', 'Service providers'],
  ['system', 'النظام', 'System'],  ['auditLog', 'سجل التدقيق', 'Audit log'],  ['settings', 'الإعدادات', 'Settings'],  ['toggleTheme', 'تبديل الوضع', 'Toggle theme'],
  ['notifications', 'الإشعارات', 'Notifications'],  ['configureAiAssistant', 'ضبط إعدادات الذكاء الاصطناعي', 'Configure AI assistant'],
  ['unsavedChanges', 'تغييرات غير محفوظة', 'Unsaved changes'],
  ['newContract', 'عقد جديد', 'New contract'],  ['exportCsv', 'تصدير CSV', 'Export CSV'],
  ['noResultsHint', 'لا توجد نتائج مطابقة — جرّب كلمات أخرى أو امسح الفلاتر.', 'No matching results — try different words or clear filters.'],  ['aiUnavailable', 'المساعد غير مهيأ — راجع الإعدادات', 'Assistant not configured — review settings'],  ['skipToContent', 'تخطي إلى المحتوى الرئيسي', 'Skip to main content'],  ['cancel', 'إلغاء', 'Cancel'],
  // ===== Financial routes UX clarity (ADR-0008) =====
  // Description shown in the PageHeader of /reports to make the page's
  // analytical purpose unambiguous (ADR-0008). The former /financials
  // description/hint/summary keys were removed with the dense-register
  // redesign (#1545), which dropped that page's description block.
  ['reportsPageDescription', 'تقارير تحليلية وتشغيلية لفهم الأداء والمتابعة واتخاذ القرار حسب الفترة والعقار.', 'Analytical and operational reports for performance, follow-up, and decisions by period and property.'],
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

export type SharedLabel = (key: string) => string;

type AppLanguageState = Readonly<{
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
