import { normalizeCompanySettingsContract, type CompanySettingsContract } from '@/lib/companySettings';
import type { CompanySettingsRecord } from './companySettingsService';

export function companySettingsRecordToContract(settings: CompanySettingsRecord | null | undefined): CompanySettingsContract {
  return normalizeCompanySettingsContract({
    companyName: settings?.company_name,
    logoUrl: settings?.logo_url,
    address: settings?.address,
    phone: settings?.phone,
    email: settings?.email,
    taxNumber: settings?.tax_number,
    registrationNumber: settings?.registration_number,
    locale: settings?.locale,
    defaultCurrency: settings?.currency,
    country: settings?.country,
    timezone: settings?.timezone,
    receiptPrefix: settings?.receipt_prefix,
    invoicePrefix: settings?.invoice_prefix,
    contractPrefix: settings?.contract_prefix,
  });
}
