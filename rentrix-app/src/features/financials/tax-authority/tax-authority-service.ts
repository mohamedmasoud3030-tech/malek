import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

function asJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export type TaxCodeCatalogRecord = {
  code: string;
  name_ar: string;
  name_en: string;
  description: string | null;
  is_active: boolean;
};

export type TaxProfileRecord = {
  id: string;
  company_id: string;
  version_no: number;
  tax_code: string;
  tax_rate: number;
  effective_from: string;
  effective_to: string | null;
  status: 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED' | 'VOID';
  description: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  is_sole_admin_exception: boolean;
};

export type FeeTaxTreatmentRecord = {
  id: string;
  company_id: string;
  fee_kind: 'RATE_MANAGEMENT_FEE' | 'FIXED_MONTHLY';
  version_no: number;
  tax_code: string;
  tax_rate: number;
  effective_from: string;
  effective_to: string | null;
  status: 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED' | 'VOID';
  description: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  is_sole_admin_exception: boolean;
};

export async function listTaxCodes(): Promise<TaxCodeCatalogRecord[]> {
  const { data, error } = await supabase.from('tax_code_catalog').select('*').eq('is_active', true).order('code');
  if (error) handleSupabaseError(error, 'تعذر تحميل أكواد الضريبة');
  return (data ?? []) as TaxCodeCatalogRecord[];
}

export async function listTaxProfiles(): Promise<TaxProfileRecord[]> {
  const { data, error } = await supabase
    .from('company_tax_profiles')
    .select('*')
    .order('effective_from', { ascending: false })
    .order('version_no', { ascending: false })
    .limit(100);
  if (error) handleSupabaseError(error, 'تعذر تحميل ملفات الضريبة');
  return (data ?? []) as TaxProfileRecord[];
}

export async function createTaxProfile(payload: {
  tax_code: string;
  tax_rate: number;
  effective_from: string;
  effective_to?: string | null;
  description?: string | null;
  request_id?: string;
}): Promise<{ profile_id: string; version_no: number; status: string }> {
  const requestId = payload.request_id || crypto.randomUUID();
  const rpcPayload = {
    tax_code: payload.tax_code,
    tax_rate: payload.tax_rate,
    effective_from: payload.effective_from,
    effective_to: payload.effective_to || null,
    description: payload.description || null,
    request_id: requestId,
  };
  const { data, error } = await supabase.rpc('create_tax_profile_atomic', { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'تعذر إنشاء ملف ضريبي');
  const obj = asJsonObject(data);
  return {
    profile_id: String(obj.profile_id ?? ''),
    version_no: Number(obj.version_no ?? 0),
    status: String(obj.status ?? 'DRAFT'),
  };
}

export async function approveTaxProfile(payload: { profile_id: string; request_id?: string }): Promise<void> {
  const requestId = payload.request_id || crypto.randomUUID();
  const { error } = await supabase.rpc('approve_tax_profile_atomic', {
    p_payload: { profile_id: payload.profile_id, request_id: requestId },
  });
  if (error) handleSupabaseError(error, 'تعذر اعتماد الملف الضريبي - يجب أن يعتمد مستخدم مختلف');
}

export async function listFeeTaxTreatments(): Promise<FeeTaxTreatmentRecord[]> {
  const { data, error } = await supabase
    .from('company_fee_tax_treatments')
    .select('*')
    .order('effective_from', { ascending: false })
    .order('version_no', { ascending: false })
    .limit(100);
  if (error) handleSupabaseError(error, 'تعذر تحميل معالجات ضريبة الأتعاب');
  return (data ?? []) as FeeTaxTreatmentRecord[];
}

export async function createFeeTaxTreatment(payload: {
  fee_kind: 'RATE_MANAGEMENT_FEE' | 'FIXED_MONTHLY';
  tax_code: string;
  tax_rate: number;
  effective_from: string;
  effective_to?: string | null;
  description?: string | null;
  request_id?: string;
}): Promise<{ treatment_id: string; version_no: number; status: string }> {
  const requestId = payload.request_id || crypto.randomUUID();
  const rpcPayload = {
    fee_kind: payload.fee_kind,
    tax_code: payload.tax_code,
    tax_rate: payload.tax_rate,
    effective_from: payload.effective_from,
    effective_to: payload.effective_to || null,
    description: payload.description || null,
    request_id: requestId,
  };
  const { data, error } = await supabase.rpc('create_fee_tax_treatment_atomic', { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'تعذر إنشاء معالجة ضريبة الأتعاب');
  const obj = asJsonObject(data);
  return {
    treatment_id: String(obj.treatment_id ?? obj.id ?? ''),
    version_no: Number(obj.version_no ?? 0),
    status: String(obj.status ?? 'DRAFT'),
  };
}

export async function approveFeeTaxTreatment(payload: { treatment_id: string; request_id?: string }): Promise<void> {
  const requestId = payload.request_id || crypto.randomUUID();
  const { error } = await supabase.rpc('approve_fee_tax_treatment_atomic', {
    p_payload: { treatment_id: payload.treatment_id, request_id: requestId },
  });
  if (error) handleSupabaseError(error, 'تعذر اعتماد معالجة ضريبة الأتعاب - يجب أن يعتمد مستخدم مختلف');
}
