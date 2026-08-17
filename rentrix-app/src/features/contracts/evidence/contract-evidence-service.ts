import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';

export type RegistrationProfile = Database['public']['Tables']['contract_registration_requirement_profiles']['Row'];
export type RegistrationRecord = Database['public']['Tables']['contract_registration_records']['Row'];
export type InspectionTemplate = Database['public']['Tables']['contract_inspection_templates']['Row'];
export type ContractInspection = Database['public']['Tables']['contract_inspections']['Row'];
export type ContractEvidenceDocument = Pick<Database['public']['Tables']['vault_documents']['Row'], 'id' | 'title' | 'document_type' | 'created_at'>;

export type ChecklistDefinitionItem = Readonly<{ code: string; label_ar: string; required: boolean }>;
export type ChecklistResponseItem = Readonly<{ code: string; condition: 'GOOD' | 'FAIR' | 'DAMAGED' | 'NOT_APPLICABLE' | ''; note: string }>;

export type ContractEvidenceState = Readonly<{
  registration_configuration_status: 'NOT_CONFIGURED' | 'CONFIGURED';
  registration_profile: RegistrationProfile | null;
  registration: RegistrationRecord | null;
  inspections: ContractInspection[];
  inspection_templates: InspectionTemplate[];
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseChecklistDefinition(value: Json): ChecklistDefinitionItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.code !== 'string' || typeof item.label_ar !== 'string') return [];
    return [{ code: item.code, label_ar: item.label_ar, required: item.required === true }];
  });
}

export function parseChecklistResponses(value: Json): ChecklistResponseItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.code !== 'string') return [];
    const condition = typeof item.condition === 'string' ? item.condition : '';
    if (!['', 'GOOD', 'FAIR', 'DAMAGED', 'NOT_APPLICABLE'].includes(condition)) return [];
    return [{ code: item.code, condition: condition as ChecklistResponseItem['condition'], note: typeof item.note === 'string' ? item.note : '' }];
  });
}

function parseState(value: Json): ContractEvidenceState {
  if (!isObject(value)) throw new Error('تعذر التحقق من حالة أدلة العقد.');
  const configuration = value.registration_configuration_status === 'CONFIGURED' ? 'CONFIGURED' : 'NOT_CONFIGURED';
  return {
    registration_configuration_status: configuration,
    registration_profile: isObject(value.registration_profile) ? value.registration_profile as unknown as RegistrationProfile : null,
    registration: isObject(value.registration) ? value.registration as unknown as RegistrationRecord : null,
    inspections: Array.isArray(value.inspections) ? value.inspections as unknown as ContractInspection[] : [],
    inspection_templates: Array.isArray(value.inspection_templates) ? value.inspection_templates as unknown as InspectionTemplate[] : [],
  };
}

export async function getContractEvidenceState(contractId: string): Promise<ContractEvidenceState> {
  const { data, error } = await supabase.rpc('get_contract_evidence_state', { p_contract_id: contractId });
  if (error) throw error;
  return parseState(data);
}

export async function listContractEvidenceDocuments(contractId: string): Promise<ContractEvidenceDocument[]> {
  const { data, error } = await supabase.from('vault_documents')
    .select('id,title,document_type,created_at')
    .eq('related_entity_type', 'contract')
    .eq('related_entity_id', contractId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitContractRegistration(input: {
  contractId: string;
  submittedOn: string;
  externalReference?: string;
  evidenceDocumentId?: string;
  requestId: string;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_contract_registration_atomic', { p_payload: {
    contract_id: input.contractId,
    submitted_on: input.submittedOn,
    external_request_reference: input.externalReference || null,
    evidence_document_id: input.evidenceDocumentId || null,
    request_id: input.requestId,
  } });
  if (error) throw error;
}

export async function decideContractRegistration(input: {
  registrationId: string;
  action: 'REGISTER' | 'REJECT';
  registrationReference?: string;
  registeredOn?: string;
  expiresOn?: string;
  feePaid?: number;
  evidenceDocumentId?: string;
  reason?: string;
  requestId: string;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_contract_registration_atomic', { p_payload: {
    registration_id: input.registrationId,
    action: input.action,
    registration_reference: input.registrationReference || null,
    registered_on: input.registeredOn || null,
    expires_on: input.expiresOn || null,
    fee_paid: input.feePaid ?? null,
    evidence_document_id: input.evidenceDocumentId || null,
    reason: input.reason || null,
    request_id: input.requestId,
  } });
  if (error) throw error;
}

export async function saveContractInspectionDraft(input: {
  inspectionId?: string;
  contractId: string;
  templateId: string;
  kind: 'MOVE_IN' | 'MOVE_OUT';
  inspectedOn: string;
  checklist: ChecklistResponseItem[];
  meterReadings: Record<string, string>;
  keysAndAccess: Record<string, string | number>;
  summary?: string;
  evidenceDocumentIds: string[];
  requestId: string;
}): Promise<ContractInspection> {
  const { data, error } = await supabase.rpc('save_contract_inspection_draft_atomic', { p_payload: {
    inspection_id: input.inspectionId || null,
    contract_id: input.contractId,
    template_id: input.templateId,
    kind: input.kind,
    inspected_on: input.inspectedOn,
    checklist: input.checklist,
    meter_readings: input.meterReadings,
    keys_and_access: input.keysAndAccess,
    summary: input.summary || null,
    evidence_document_ids: input.evidenceDocumentIds,
    request_id: input.requestId,
  } });
  if (error) throw error;
  return data as unknown as ContractInspection;
}

export async function completeContractInspection(input: {
  inspectionId: string;
  tenantSignature: string;
  officeSignature: string;
  requestId: string;
}): Promise<void> {
  const { error } = await supabase.rpc('complete_contract_inspection_atomic', { p_payload: {
    inspection_id: input.inspectionId,
    tenant_signature: input.tenantSignature,
    office_signature: input.officeSignature,
    request_id: input.requestId,
  } });
  if (error) throw error;
}

export async function reviewContractInspection(input: {
  inspectionId: string;
  action: 'APPROVE' | 'REQUEST_CHANGES';
  reason?: string;
  requestId: string;
}): Promise<void> {
  const { error } = await supabase.rpc('review_contract_inspection_atomic', { p_payload: {
    inspection_id: input.inspectionId,
    action: input.action,
    reason: input.reason || null,
    request_id: input.requestId,
  } });
  if (error) throw error;
}

export function newEvidenceRequestId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}
