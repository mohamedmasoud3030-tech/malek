import { useMemo } from 'react';
import {
  documentSettingsFromCompanyRecord,
  type DocumentCompanySettings,
} from '@/services/documents/companyIdentity';
import type { DocumentSettings } from '@/services/documents/DocumentTemplates';
import { useCompanySettings } from './useCompanySettings';

/**
 * Adapts the real `company_settings` record into the document platform's
 * settings contract via the single canonical adapter
 * (`documentSettingsFromCompanyRecord`). Unlike
 * `useCompanySettingsContract`, this never falls back to a normalized
 * default while the settings query is loading or has not returned a row
 * yet — `isReady` is false until a real company name and currency are
 * confirmed, so callers must disable print/PDF actions instead of letting
 * them fire with placeholder branding.
 *
 * `settings` keeps the historical template-facing shape for compatibility
 * callers; `companySettings` is the canonical typed contract new callers
 * should consume.
 */
export function useDocumentSettings(): {
  settings: DocumentSettings;
  companySettings: DocumentCompanySettings;
  isReady: boolean;
  isLoading: boolean;
} {
  const companySettingsQuery = useCompanySettings();
  const record = companySettingsQuery.data;

  return useMemo(() => {
    const { settings: companySettings, isReady } = documentSettingsFromCompanyRecord(record);
    const settings: DocumentSettings = {
      company: {
        name: companySettings.companyName,
        legalName: companySettings.legalName ?? undefined,
        address: companySettings.address ?? undefined,
        phone: companySettings.phone ?? undefined,
        email: companySettings.email ?? undefined,
        taxNumber: companySettings.taxNumber ?? undefined,
        registrationNumber: companySettings.registrationNumber ?? undefined,
        logoUrl: companySettings.logoUrl ?? undefined,
      },
      currency: companySettings.currency,
      currencySymbol: companySettings.currencySymbol ?? undefined,
      invoicePrefix: companySettings.documentPrefixes.invoice ?? undefined,
      contractPrefix: companySettings.documentPrefixes.contract ?? undefined,
      receiptPrefix: companySettings.documentPrefixes.receipt ?? undefined,
    };
    return { settings, companySettings, isReady, isLoading: companySettingsQuery.isLoading };
  }, [record, companySettingsQuery.isLoading]);
}
