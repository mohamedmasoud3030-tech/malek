/**
 * Contract feature document adapters and actions.
 *
 * Provides typed payload adapters and guarded print/PDF actions for:
 *  - #1 Lease Summary Sheet (reusing 'contract')
 *  - #2 Move-In / Move-Out Snagging ('unit_inspection')
 *  - #3 Lease Renewal / Vacate Notice ('lease_notice')
 *  - #10 Tenant Final Clearance ('tenant_clearance')
 *  - #24 Eviction / Rental Dispute Legal Dossier ('legal_dossier')
 *
 * Strict pass-through of domain data: no client-side financial calculations.
 */
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type {
  ContractDocumentPayload,
  LegalDossierPayload,
  LeaseNoticePayload,
  TenantClearancePayload,
  UnitInspectionPayload,
} from '@/services/documents/documentPayloads';
import type { ContractDetail } from '../services/contractService';
import { parseChecklistResponses, type ContractInspection } from '../evidence/contract-evidence-service';

/* ------------------------------------------------------------------ */
/* #1 Lease Summary Sheet (reusing 'contract')                         */
/* ------------------------------------------------------------------ */

export function toLeaseSummaryPayload(contract: ContractDetail): ContractDocumentPayload {
  return {
    reference: contract.reference ?? null,
    status: contract.status,
    startDate: contract.start_date,
    endDate: contract.end_date,
    rentAmount: Number(contract.rent_amount ?? 0),
    paymentCycle: contract.payment_cycle,
    notes: contract.notes ?? null,
    tenantName: contract.people?.full_name ?? null,
    tenantNationalId: contract.people?.national_id ?? null,
    tenantPhone: contract.people?.phone ?? null,
    propertyTitle: contract.properties?.title ?? null,
    unitNumber: contract.units?.unit_number ?? null,
  };
}

export function printLeaseSummary(contract: ContractDetail, settings: DocumentCompanySettings): Promise<void> {
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('contract', {
        settings,
        payload: toLeaseSummaryPayload(contract),
      }),
    fallbackMessage: 'تعذرت طباعة ملخص عقد الإيجار.',
  });
}

export function downloadLeaseSummaryPdf(contract: ContractDetail, settings: DocumentCompanySettings): Promise<void> {
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('contract', {
        settings,
        payload: toLeaseSummaryPayload(contract),
      }),
    fallbackMessage: 'تعذر تصدير ملخص عقد الإيجار كملف PDF.',
  });
}

/* ------------------------------------------------------------------ */
/* #2 Move-In / Move-Out Snagging ('unit_inspection')                  */
/* ------------------------------------------------------------------ */

export function toUnitInspectionPayload(params: {
  inspection: ContractInspection;
  contract: ContractDetail;
  inspectorName?: string | null;
  reference?: string | null;
}): UnitInspectionPayload {
  const { inspection, contract, inspectorName, reference } = params;
  const responses = parseChecklistResponses(inspection.checklist);
  if (responses.length === 0) {
    throw new Error('لا يمكن إصدار محضر الفحص دون وجود بنود فحص مسجلة.');
  }

  const mode: UnitInspectionPayload['inspectionMode'] =
    inspection.kind === 'MOVE_IN' ? 'move_in' : inspection.kind === 'MOVE_OUT' ? 'move_out' : 'inspection';

  const conditionLabels: Record<string, string> = {
    GOOD: 'سليم / ممتاز',
    FAIR: 'مقبول / بحاجة لمتابعة',
    DAMAGED: 'تالف / متضرر',
    NOT_APPLICABLE: 'غير منطبق',
  };

  const conditionRows = responses.map((item) => ({
    areaOrItem: item.code,
    condition: conditionLabels[item.condition] ?? item.condition,
    note: item.note || null,
  }));

  let meterReadings: UnitInspectionPayload['meterReadings'] = null;
  if (inspection.meter_readings && typeof inspection.meter_readings === 'object') {
    const raw = inspection.meter_readings as Record<string, unknown>;
    const list: Array<{ meter: string; reading: string; unit?: string | null }> = [];
    if (raw.electricity != null && String(raw.electricity).trim()) {
      list.push({ meter: 'عداد الكهرباء', reading: String(raw.electricity) });
    }
    if (raw.water != null && String(raw.water).trim()) {
      list.push({ meter: 'عداد المياه', reading: String(raw.water) });
    }
    if (list.length > 0) meterReadings = list;
  }

  let keyHandover: UnitInspectionPayload['keyHandover'] = null;
  if (inspection.keys_and_access && typeof inspection.keys_and_access === 'object') {
    const raw = inspection.keys_and_access as Record<string, unknown>;
    const count = Number(raw.key_count ?? 0);
    if (count > 0 || raw.notes) {
      keyHandover = [{ item: 'مفاتيح الوحدة وملحقات الدخول', quantity: count, note: typeof raw.notes === 'string' ? raw.notes : null }];
    }
  }

  return {
    reference: reference ?? null,
    inspectionDate: inspection.inspected_on,
    inspectionMode: mode,
    propertyTitle: contract.properties?.title ?? null,
    unitNumber: contract.units?.unit_number ?? null,
    tenantName: contract.people?.full_name ?? null,
    conditionRows,
    meterReadings,
    keyHandover,
    notes: inspection.summary ?? null,
    inspectorName: inspectorName ?? null,
  };
}

export function printUnitInspection(params: {
  inspection: ContractInspection;
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  inspectorName?: string | null;
  reference?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('unit_inspection', {
        settings,
        payload: toUnitInspectionPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة محضر فحص ومعاينة الوحدة.',
  });
}

export function downloadUnitInspectionPdf(params: {
  inspection: ContractInspection;
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  inspectorName?: string | null;
  reference?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('unit_inspection', {
        settings,
        payload: toUnitInspectionPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير محضر الفحص كملف PDF.',
  });
}

/* ------------------------------------------------------------------ */
/* #3 Lease Renewal / Vacate Notice ('lease_notice')                   */
/* ------------------------------------------------------------------ */

export function toLeaseNoticePayload(params: {
  contract: ContractDetail;
  noticeKind: 'renewal' | 'vacate' | 'non_renewal';
  noticeDate: string;
  effectiveDate?: string | null;
  approvedMessage?: string | null;
  reference?: string | null;
  notes?: string | null;
}): LeaseNoticePayload {
  const { contract, noticeKind, noticeDate, effectiveDate, approvedMessage, reference, notes } = params;
  return {
    reference: reference ?? contract.reference ?? null,
    tenantName: contract.people?.full_name ?? null,
    propertyTitle: contract.properties?.title ?? null,
    unitNumber: contract.units?.unit_number ?? null,
    currentEndDate: contract.end_date,
    noticeDate,
    noticeKind,
    effectiveDate: effectiveDate ?? contract.end_date ?? null,
    approvedMessage: approvedMessage ?? null,
    notes: notes ?? null,
  };
}

export function printLeaseNotice(params: {
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  noticeKind: 'renewal' | 'vacate' | 'non_renewal';
  noticeDate: string;
  effectiveDate?: string | null;
  approvedMessage?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('lease_notice', {
        settings,
        payload: toLeaseNoticePayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة الإشعار العقاري.',
  });
}

export function downloadLeaseNoticePdf(params: {
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  noticeKind: 'renewal' | 'vacate' | 'non_renewal';
  noticeDate: string;
  effectiveDate?: string | null;
  approvedMessage?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('lease_notice', {
        settings,
        payload: toLeaseNoticePayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير الإشعار العقاري كملف PDF.',
  });
}

/* ------------------------------------------------------------------ */
/* #10 Tenant Final Clearance ('tenant_clearance')                     */
/* ------------------------------------------------------------------ */

export function toTenantClearancePayload(params: {
  contract: ContractDetail;
  clearanceDate: string;
  clearanceStatus: 'cleared' | 'outstanding' | 'pending';
  outstandingAmount?: number | null;
  depositDisposition?: string | null;
  depositAmount?: number | null;
  maintenanceNotes?: string | null;
  utilityNotes?: string | null;
  reference?: string | null;
  notes?: string | null;
}): TenantClearancePayload {
  const {
    contract,
    clearanceDate,
    clearanceStatus,
    outstandingAmount,
    depositDisposition,
    depositAmount,
    maintenanceNotes,
    utilityNotes,
    reference,
    notes,
  } = params;

  if (clearanceStatus === 'cleared' && outstandingAmount != null && outstandingAmount > 0) {
    throw new Error('لا يمكن إصدار شهادة براءة ذمة نهائية مع وجود مبالغ معلقة.');
  }

  return {
    reference: reference ?? contract.reference ?? null,
    clearanceDate,
    tenantName: contract.people?.full_name ?? null,
    propertyTitle: contract.properties?.title ?? null,
    unitNumber: contract.units?.unit_number ?? null,
    clearanceStatus,
    outstandingAmount: outstandingAmount ?? null,
    depositDisposition: depositDisposition ?? null,
    depositAmount: depositAmount ?? null,
    maintenanceNotes: maintenanceNotes ?? null,
    utilityNotes: utilityNotes ?? null,
    notes: notes ?? null,
  };
}

export function printTenantClearance(params: {
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  clearanceDate: string;
  clearanceStatus: 'cleared' | 'outstanding' | 'pending';
  outstandingAmount?: number | null;
  depositDisposition?: string | null;
  depositAmount?: number | null;
  maintenanceNotes?: string | null;
  utilityNotes?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('tenant_clearance', {
        settings,
        payload: toTenantClearancePayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة شهادة المخالصة.',
  });
}

export function downloadTenantClearancePdf(params: {
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  clearanceDate: string;
  clearanceStatus: 'cleared' | 'outstanding' | 'pending';
  outstandingAmount?: number | null;
  depositDisposition?: string | null;
  depositAmount?: number | null;
  maintenanceNotes?: string | null;
  utilityNotes?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('tenant_clearance', {
        settings,
        payload: toTenantClearancePayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير شهادة المخالصة كملف PDF.',
  });
}

/* ------------------------------------------------------------------ */
/* #24 Eviction / Dispute Legal Dossier ('legal_dossier')              */
/* ------------------------------------------------------------------ */

export function toLegalDossierPayload(params: {
  contract: ContractDetail;
  timelineEvents: Array<{ date: string; eventType: string; description: string; source?: string | null }>;
  unpaidInvoiceRefs?: Array<{ reference: string; amount: number; dueDate?: string | null }> | null;
  totalArrearsAmount?: number | null;
  noticeRefs?: string[] | null;
  caseStatus?: string | null;
  reference?: string | null;
  notes?: string | null;
}): LegalDossierPayload {
  const {
    contract,
    timelineEvents,
    unpaidInvoiceRefs,
    totalArrearsAmount,
    noticeRefs,
    caseStatus,
    reference,
    notes,
  } = params;

  if (!timelineEvents || timelineEvents.length === 0) {
    throw new Error('لا يمكن إصدار ملف النزاع القانوني بدون وقائع تسلسل زمني مسجلة.');
  }

  return {
    reference: reference ?? null,
    contractReference: contract.reference ?? null,
    tenantName: contract.people?.full_name ?? null,
    propertyTitle: contract.properties?.title ?? null,
    unitNumber: contract.units?.unit_number ?? null,
    timelineEvents,
    unpaidInvoiceRefs: unpaidInvoiceRefs ?? null,
    totalArrearsAmount: totalArrearsAmount ?? null,
    noticeRefs: noticeRefs ?? null,
    caseStatus: caseStatus ?? null,
    notes: notes ?? null,
  };
}

export function printLegalDossier(params: {
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  timelineEvents: Array<{ date: string; eventType: string; description: string; source?: string | null }>;
  unpaidInvoiceRefs?: Array<{ reference: string; amount: number; dueDate?: string | null }> | null;
  totalArrearsAmount?: number | null;
  noticeRefs?: string[] | null;
  caseStatus?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('legal_dossier', {
        settings,
        payload: toLegalDossierPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة ملف الأدلة القانونية.',
  });
}

export function downloadLegalDossierPdf(params: {
  contract: ContractDetail;
  settings: DocumentCompanySettings;
  timelineEvents: Array<{ date: string; eventType: string; description: string; source?: string | null }>;
  unpaidInvoiceRefs?: Array<{ reference: string; amount: number; dueDate?: string | null }> | null;
  totalArrearsAmount?: number | null;
  noticeRefs?: string[] | null;
  caseStatus?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('legal_dossier', {
        settings,
        payload: toLegalDossierPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير ملف الأدلة القانونية كملف PDF.',
  });
}
