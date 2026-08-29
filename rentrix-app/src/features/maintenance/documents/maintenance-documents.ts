/**
 * Maintenance feature document adapters and actions.
 *
 * Dedicated technical types:
 *  - #19 Maintenance Work Order ('maintenance_work_order')
 *  - #20 Maintenance Completion Certificate ('maintenance_completion')
 *
 * No lifecycle side effects: printing does not mutate maintenance state.
 * Costs and estimates are strictly passed from canonical maintenance records.
 */
import { documentService } from '@/services/documents/DocumentService';
import { toDateOnlyISO } from '@/lib/formatters';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { MaintenanceCompletionPayload, MaintenanceWorkOrderPayload } from '@/services/documents/documentPayloads';
import type { Maintenance } from '../maintenance-service';

/* ------------------------------------------------------------------ */
/* #19 Maintenance Work Order ('maintenance_work_order')               */
/* ------------------------------------------------------------------ */

export function toMaintenanceWorkOrderPayload(params: {
  maintenance: Maintenance;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  reference?: string | null;
  instructions?: string | null;
  assignedProvider?: string | null;
  responsibleParty?: string | null;
}): MaintenanceWorkOrderPayload {
  const { maintenance, propertyTitle, unitNumber, reference, instructions, assignedProvider, responsibleParty } = params;

  return {
    reference: reference ?? null,
    status: maintenance.status ?? 'open',
    issueDate: maintenance.created_at ? maintenance.created_at.split('T')[0] : toDateOnlyISO(),
    scheduledDate: maintenance.scheduled_date ?? null,
    propertyTitle: propertyTitle ?? null,
    unitNumber: unitNumber ?? null,
    title: maintenance.title ?? 'طلب صيانة',
    description: maintenance.description ?? null,
    category: maintenance.service_provider_category_id ?? null,
    priority: maintenance.priority ?? 'medium',
    assignedProvider: assignedProvider ?? null,
    technicianName: maintenance.technician_name ?? null,
    responsibleParty: responsibleParty ?? null,
    approvedEstimate: maintenance.cost != null ? Number(maintenance.cost) : null,
    instructions: instructions ?? null,
  };
}

export function printMaintenanceWorkOrder(params: {
  maintenance: Maintenance;
  settings: DocumentCompanySettings;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  reference?: string | null;
  instructions?: string | null;
  assignedProvider?: string | null;
  responsibleParty?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('maintenance_work_order', {
        settings,
        payload: toMaintenanceWorkOrderPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة أمر عمل الصيانة.',
  });
}

export function downloadMaintenanceWorkOrderPdf(params: {
  maintenance: Maintenance;
  settings: DocumentCompanySettings;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  reference?: string | null;
  instructions?: string | null;
  assignedProvider?: string | null;
  responsibleParty?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('maintenance_work_order', {
        settings,
        payload: toMaintenanceWorkOrderPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير أمر عمل الصيانة كملف PDF.',
  });
}

/* ------------------------------------------------------------------ */
/* #20 Maintenance Completion Certificate ('maintenance_completion')  */
/* ------------------------------------------------------------------ */

export function toMaintenanceCompletionPayload(params: {
  maintenance: Maintenance;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  reference?: string | null;
  completionDate?: string | null;
  workPerformed?: string | null;
  providerName?: string | null;
  tenantAccepted?: boolean | null;
  managerAccepted?: boolean | null;
  notes?: string | null;
}): MaintenanceCompletionPayload {
  const {
    maintenance,
    propertyTitle,
    unitNumber,
    reference,
    completionDate,
    workPerformed,
    providerName,
    tenantAccepted,
    managerAccepted,
    notes,
  } = params;

  return {
    reference: reference ?? null,
    completionDate: completionDate ?? toDateOnlyISO(),
    status: maintenance.status ?? 'resolved',
    propertyTitle: propertyTitle ?? null,
    unitNumber: unitNumber ?? null,
    title: maintenance.title ?? 'إنجاز صيانة',
    workPerformed: workPerformed ?? maintenance.description ?? null,
    providerName: providerName ?? maintenance.technician_name ?? null,
    approvedFinalCost: maintenance.cost != null ? Number(maintenance.cost) : null,
    evidenceRefs: maintenance.attachment_url ? [maintenance.attachment_url] : null,
    tenantAccepted: tenantAccepted ?? null,
    managerAccepted: managerAccepted ?? null,
    notes: notes ?? null,
  };
}

export function printMaintenanceCompletion(params: {
  maintenance: Maintenance;
  settings: DocumentCompanySettings;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  reference?: string | null;
  completionDate?: string | null;
  workPerformed?: string | null;
  providerName?: string | null;
  tenantAccepted?: boolean | null;
  managerAccepted?: boolean | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('maintenance_completion', {
        settings,
        payload: toMaintenanceCompletionPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة شهادة إنجاز الصيانة.',
  });
}

export function downloadMaintenanceCompletionPdf(params: {
  maintenance: Maintenance;
  settings: DocumentCompanySettings;
  propertyTitle?: string | null;
  unitNumber?: string | null;
  reference?: string | null;
  completionDate?: string | null;
  workPerformed?: string | null;
  providerName?: string | null;
  tenantAccepted?: boolean | null;
  managerAccepted?: boolean | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('maintenance_completion', {
        settings,
        payload: toMaintenanceCompletionPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير شهادة إنجاز الصيانة كملف PDF.',
  });
}
