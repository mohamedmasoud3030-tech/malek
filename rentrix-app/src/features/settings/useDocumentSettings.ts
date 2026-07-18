import { useMemo } from 'react';
import { getCurrencySymbol } from '@/lib/numberToArabicWords';
import type { DocumentSettings } from '@/services/documents/DocumentTemplates';
import { useCompanySettings } from './useCompanySettings';

/**
 * Adapts the real `company_settings` record into the `DocumentSettings`
 * shape the document/print engine requires. Unlike `useCompanySettingsContract`,
 * this does not fall back to a normalized default while the settings query is
 * loading or has not returned a row yet — `isReady` is false until a real
 * company name and currency are confirmed, so callers can disable print/PDF
 * actions instead of letting them fire with placeholder branding.
 */
export function useDocumentSettings(): { settings: DocumentSettings; isReady: boolean; isLoading: boolean } {
  const companySettingsQuery = useCompanySettings();
  const record = companySettingsQuery.data;

  return useMemo(() => {
    const isReady = Boolean(record?.company_name?.trim() && record?.currency?.trim());
    const settings: DocumentSettings = {
      company: {
        name: record?.company_name ?? '',
        address: record?.address ?? undefined,
        phone: record?.phone ?? undefined,
        email: record?.email ?? undefined,
        taxNumber: record?.tax_number ?? undefined,
        registrationNumber: record?.registration_number ?? undefined,
        logoUrl: record?.logo_url ?? undefined,
      },
      currency: record?.currency ?? '',
      currencySymbol: record?.currency ? getCurrencySymbol(record.currency) : undefined,
      invoicePrefix: record?.invoice_prefix ?? undefined,
      contractPrefix: record?.contract_prefix ?? undefined,
      receiptPrefix: record?.receipt_prefix ?? undefined,
    };
    return { settings, isReady, isLoading: companySettingsQuery.isLoading };
  }, [record, companySettingsQuery.isLoading]);
}
