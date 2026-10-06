export type Lang = 'ar' | 'en';

const ar = {
  meta: {
    title: 'MALEK | كل أملاكك في مكان واحد',
    description:
      'منصة عربية RTL بالكامل لإدارة العقارات الإيجارية: العقارات والوحدات والعقود والفواتير والتحصيلات والصيانة والتقارير.',
  },
  nav: {
    start: 'ابدأ الآن',
  },
  footer: {
    tagline:
      'منصة عربية لإدارة العقارات الإيجارية: عقارات، عقود، مالية، صيانة وتقارير — في مساحة عمل واحدة.',
    companyTitle: 'الشركة',
    companyLinks: ['اطلب عرضاً تجريبياً', 'تواصل معنا'],
    legalTitle: 'القانونية',
    legalLinks: ['سياسة الخصوصية', 'شروط الاستخدام'],
    contactTitle: 'تواصل',
    motto: 'صُنع بشغف لمكاتب العقارات في الخليج',
    rights: 'جميع الحقوق محفوظة.',
  },
} as const;

// Widen literal types (from `as const`) into their writable string/number forms so the
// English dictionary can reuse the exact same shape without literal-type mismatches.
type WidenLiteral<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends readonly (infer U)[]
      ? readonly WidenLiteral<U>[]
      : { [K in keyof T]: WidenLiteral<T[K]> };

export type Messages = WidenLiteral<typeof ar>;

const en: Messages = {
  meta: {
    title: 'MALEK | One system to run your entire rental portfolio',
    description:
      'A fully Arabic-RTL property management platform: properties, units, contracts, invoicing, collections, maintenance and reports — in one workspace.',
  },
  nav: {
    start: 'Get started',
  },
  footer: {
    tagline: 'An Arabic platform for rental property management: properties, contracts, finance, maintenance and reports — in one workspace.',
    companyTitle: 'Company',
    companyLinks: ['Book a demo', 'Contact us'],
    legalTitle: 'Legal',
    legalLinks: ['Privacy policy', 'Terms of use'],
    contactTitle: 'Contact',
    motto: 'Built with passion for Gulf real-estate offices',
    rights: 'All rights reserved.',
  },
};

export const messages: Record<Lang, Messages> = { ar, en };
