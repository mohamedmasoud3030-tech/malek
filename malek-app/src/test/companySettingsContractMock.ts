import { APP_BRAND_NAME } from '@/lib/brand';
import type { CompanySettingsContract } from '@/lib/companySettings';

export const testCompanySettingsContract: CompanySettingsContract = {
  companyName: APP_BRAND_NAME,
  logoUrl: null,
  defaultLanguage: 'ar',
  defaultCurrency: 'OMR',
  country: 'OM',
  timezone: 'Asia/Muscat',
  receiptPrefix: 'REC',
  invoicePrefix: 'INV',
  contractPrefix: 'CON',
  locale: 'ar-OM',
  direction: 'rtl',
};
