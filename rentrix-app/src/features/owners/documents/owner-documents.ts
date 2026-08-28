/**
 * Owner feature document adapters and actions.
 *
 * Provides typed payload adapters and guarded print/PDF actions for:
 *  - #11 Owner Settlement Statement ('owner_settlement')
 *  - #13 Management Exit Clearance ('management_exit')
 *
 * Financial amounts are passed directly from canonical owner settlement
 * authorities. Never recalculates net payouts or fees in the presentation layer.
 */
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { ManagementExitPayload, OwnerSettlementPayload } from '@/services/documents/documentPayloads';
import type { OwnerSettlementRecord } from '../services/owner-settlements-service';

/* ------------------------------------------------------------------ */
/* #11 Owner Settlement Statement ('owner_settlement')                 */
/* ------------------------------------------------------------------ */

export function toOwnerSettlementPayload(params: {
  settlement: OwnerSettlementRecord;
  reference?: string | null;
  supportingRows?: Array<{ description: string; amount: number; type: 'credit' | 'debit' }>;
}): OwnerSettlementPayload {
  const { settlement, reference, supportingRows } = params;
  return {
    reference: reference ?? null,
    status: settlement.status,
    periodFrom: settlement.period_start,
    periodTo: settlement.period_end,
    ownerName: settlement.owner_name,
    propertyTitle: settlement.property_title,
    // All values passed verbatim from canonical settlement record
    collectedOwnerFunds: settlement.gross_rent_collected,
    managementFee: settlement.management_fee_amount,
    ownerExpenses: settlement.owner_expenses,
    netDue: settlement.net_payable_amount,
    payoutReference: settlement.payout_reference ?? null,
    payoutDate: settlement.paid_at ?? null,
    supportingRows: supportingRows ?? [],
    notes: settlement.notes ?? null,
  };
}

export function printOwnerSettlement(params: {
  settlement: OwnerSettlementRecord;
  settings: DocumentCompanySettings;
  reference?: string | null;
  supportingRows?: Array<{ description: string; amount: number; type: 'credit' | 'debit' }>;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('owner_settlement', {
        settings,
        payload: toOwnerSettlementPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة كشف تسوية المالك.',
  });
}

export function downloadOwnerSettlementPdf(params: {
  settlement: OwnerSettlementRecord;
  settings: DocumentCompanySettings;
  reference?: string | null;
  supportingRows?: Array<{ description: string; amount: number; type: 'credit' | 'debit' }>;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('owner_settlement', {
        settings,
        payload: toOwnerSettlementPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير كشف تسوية المالك كملف PDF.',
  });
}

/* ------------------------------------------------------------------ */
/* #13 Management Exit Clearance ('management_exit')                   */
/* ------------------------------------------------------------------ */

export function toManagementExitPayload(params: {
  propertyTitle: string;
  ownerName: string;
  exitDate: string;
  agreementEndDate?: string | null;
  status?: string | null;
  reference?: string | null;
  keysHandover?: Array<{ item: string; quantity?: number | null; note?: string | null }> | null;
  documentsHandover?: Array<{ item: string; quantity?: number | null; note?: string | null }> | null;
  outstandingSettlementNote?: string | null;
  notes?: string | null;
}): ManagementExitPayload {
  return {
    reference: params.reference ?? null,
    propertyTitle: params.propertyTitle,
    ownerName: params.ownerName,
    agreementEndDate: params.agreementEndDate ?? null,
    exitDate: params.exitDate,
    status: params.status ?? 'completed',
    keysHandover: params.keysHandover ?? null,
    documentsHandover: params.documentsHandover ?? null,
    outstandingSettlementNote: params.outstandingSettlementNote ?? null,
    notes: params.notes ?? null,
  };
}

export function printManagementExit(params: {
  settings: DocumentCompanySettings;
  propertyTitle: string;
  ownerName: string;
  exitDate: string;
  agreementEndDate?: string | null;
  status?: string | null;
  reference?: string | null;
  keysHandover?: Array<{ item: string; quantity?: number | null; note?: string | null }> | null;
  documentsHandover?: Array<{ item: string; quantity?: number | null; note?: string | null }> | null;
  outstandingSettlementNote?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('management_exit', {
        settings,
        payload: toManagementExitPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة محضر إنهاء إدارة العقار.',
  });
}

export function downloadManagementExitPdf(params: {
  settings: DocumentCompanySettings;
  propertyTitle: string;
  ownerName: string;
  exitDate: string;
  agreementEndDate?: string | null;
  status?: string | null;
  reference?: string | null;
  keysHandover?: Array<{ item: string; quantity?: number | null; note?: string | null }> | null;
  documentsHandover?: Array<{ item: string; quantity?: number | null; note?: string | null }> | null;
  outstandingSettlementNote?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('management_exit', {
        settings,
        payload: toManagementExitPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير محضر إنهاء إدارة العقار كملف PDF.',
  });
}
