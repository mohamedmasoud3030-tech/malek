import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database } from '@/types/database';

export type CostCenterRecord = Database['public']['Tables']['cost_centers']['Row'];
type CostCenterInsert = Database['public']['Tables']['cost_centers']['Insert'];
type CostCenterUpdate = Database['public']['Tables']['cost_centers']['Update'];

export type CostCenterFormValues = Readonly<{
  name: string;
  property_id: string;
  parent_id: string;
  is_active: boolean;
}>;

export const ACTIVE_COMPANY_REQUIRED_ERROR = 'لا توجد شركة نشطة محددة.';

// `cost_centers` is company-scoped and its RLS policies now require
// `company_id = current_company_id()` (WP-DB0 correction C2). The tenant key
// must therefore be part of every write payload, not left to a default.
export function costCenterPayload(values: CostCenterFormValues, companyId: string): CostCenterInsert {
  return {
    name: values.name.trim(),
    property_id: values.property_id.trim() || null,
    parent_id: values.parent_id.trim() || null,
    is_active: values.is_active,
    company_id: companyId,
  };
}

export async function listCostCenters(): Promise<CostCenterRecord[]> {
  const { data, error } = await supabase
    .from('cost_centers')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<CostCenterRecord[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل مراكز التكلفة');
  return data ?? [];
}

export async function saveCostCenter(
  values: CostCenterFormValues,
  companyId: string,
  id?: string,
): Promise<CostCenterRecord> {
  if (!companyId) throw new Error(ACTIVE_COMPANY_REQUIRED_ERROR);
  const payload = costCenterPayload(values, companyId);
  if (!payload.name) throw new Error('اسم مركز التكلفة مطلوب.');
  if (payload.parent_id && payload.parent_id === id) throw new Error('لا يمكن جعل مركز التكلفة تابعاً لنفسه.');

  if (id) {
    // company_id is never reassigned on update: moving a cost centre between
    // companies is not a supported operation.
    const { company_id: _companyId, ...mutable } = payload;
    const updatePayload: CostCenterUpdate = { ...mutable, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('cost_centers')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single()
      .returns<CostCenterRecord>();
    if (error) handleSupabaseError(error, 'تعذر تحديث مركز التكلفة');
    if (!data) throw new Error('تعذر تحديث مركز التكلفة');
    return data;
  }

  const { data, error } = await supabase
    .from('cost_centers')
    .insert(payload)
    .select('*')
    .single()
    .returns<CostCenterRecord>();
  if (error) handleSupabaseError(error, 'تعذر إنشاء مركز التكلفة');
  if (!data) throw new Error('تعذر إنشاء مركز التكلفة');
  return data;
}

export async function archiveCostCenter(id: string): Promise<void> {
  const updatePayload: CostCenterUpdate = { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('cost_centers')
    .update(updatePayload)
    .eq('id', id)
    .is('deleted_at', null);
  if (error) handleSupabaseError(error, 'تعذر أرشفة مركز التكلفة');
}
