/**
 * MALIK contact information — the single source of truth for support channels.
 */
export const SUPPORT_CONTACTS = {
  oman: {
    label: 'واتساب عُمان',
    number: '+968 9192 8186',
    whatsappUrl: 'https://wa.me/96891928186',
  },
  egypt: {
    label: 'واتساب مصر',
    number: '+20 121 210 1073',
    whatsappUrl: 'https://wa.me/201212101073',
  },
  saudi: {
    label: 'واتساب السعودية',
    number: '+966 50 868 8213',
    whatsappUrl: 'https://wa.me/966508688213',
  },
  emails: [
    { label: 'البريد الإلكتروني', address: 'Ahmedmasoud@outlook.com' },
    { label: 'البريد الإلكتروني', address: 'MohamedMs.oud@outlook.com' },
  ],
} as const;

export type SupportContact = typeof SUPPORT_CONTACTS;
