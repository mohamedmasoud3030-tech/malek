/**
 * Unit Lifecycle Passport document adapter and actions (#15).
 *
 * Dedicated technical type: 'unit_passport'.
 * Read-only dossier consolidating unit identity, leases, and maintenance history.
 * Never acts as a competing balance authority.
 */
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { UnitPassportPayload } from '@/services/documents/documentPayloads';
import type { Unit } from '@/types/domain';

export function toUnitPassportPayload(params: {
  unit: Pick<Unit, 'unit_number' | 'status'> & { unit_type?: string | null; notes?: string | null };
  propertyTitle?: string | null;
  leaseHistory?: Array<{
    tenantName: string;
    startDate: string;
    endDate?: string | null;
    status: string;
    rentAmount?: number | null;
  }>;
  maintenanceHistory?: Array<{
    date: string;
    title: string;
    status: string;
    cost?: number | null;
  }>;
  utilitySummary?: string | null;
  financialSummaryNote?: string | null;
  notes?: string | null;
}): UnitPassportPayload {
  const {
    unit,
    propertyTitle,
    leaseHistory,
    maintenanceHistory,
    utilitySummary,
    financialSummaryNote,
    notes,
  } = params;

  return {
    propertyTitle: propertyTitle ?? null,
    unitNumber: unit.unit_number ?? null,
    unitType: unit.unit_type ?? null,
    currentStatus: unit.status,
    leaseHistory: leaseHistory ?? [],
    maintenanceHistory: maintenanceHistory ?? [],
    utilitySummary: utilitySummary ?? null,
    financialSummaryNote: financialSummaryNote ?? null,
    notes: notes ?? unit.notes ?? null,
  };
}

export function printUnitPassport(params: {
  unit: Pick<Unit, 'unit_number' | 'status'> & { unit_type?: string | null; notes?: string | null };
  settings: DocumentCompanySettings;
  propertyTitle?: string | null;
  leaseHistory?: Array<{
    tenantName: string;
    startDate: string;
    endDate?: string | null;
    status: string;
    rentAmount?: number | null;
  }>;
  maintenanceHistory?: Array<{
    date: string;
    title: string;
    status: string;
    cost?: number | null;
  }>;
  utilitySummary?: string | null;
  financialSummaryNote?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('unit_passport', {
        settings,
        payload: toUnitPassportPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة جواز الوحدة العقارية.',
  });
}

export function downloadUnitPassportPdf(params: {
  unit: Pick<Unit, 'unit_number' | 'status'> & { unit_type?: string | null; notes?: string | null };
  settings: DocumentCompanySettings;
  propertyTitle?: string | null;
  leaseHistory?: Array<{
    tenantName: string;
    startDate: string;
    endDate?: string | null;
    status: string;
    rentAmount?: number | null;
  }>;
  maintenanceHistory?: Array<{
    date: string;
    title: string;
    status: string;
    cost?: number | null;
  }>;
  utilitySummary?: string | null;
  financialSummaryNote?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('unit_passport', {
        settings,
        payload: toUnitPassportPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير جواز الوحدة العقارية كملف PDF.',
  });
}
