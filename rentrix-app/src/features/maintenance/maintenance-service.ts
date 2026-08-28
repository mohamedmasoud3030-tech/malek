import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import { getMaintenanceStatusVariants, normalizeMaintenancePriority, normalizeMaintenanceStatus } from '@/lib/maintenanceStatus';
import type { Database } from '@/types/database';

export type Maintenance = Database['public']['Tables']['maintenance_records']['Row'];
export type MaintenanceStatus = Maintenance['status'] | 'all';
export type MaintenancePayload = Database['public']['Tables']['maintenance_records']['Insert'];
export type MaintenanceUpdate = Pick<Database['public']['Tables']['maintenance_records']['Update'],
  | 'property_id'
  | 'unit_id'
  | 'service_provider_id'
  | 'service_provider_category_id'
  | 'title'
  | 'description'
  | 'priority'
  | 'assigned_to'
  | 'technician_name'
  | 'scheduled_date'
  | 'attachment_url'>;
export async function listMaintenance(status: MaintenanceStatus, propertyId: string): Promise<Maintenance[]> {
  try {
    // Maintenance queues and report KPIs must not silently stop at PostgREST's
    // default 1,000-row response cap.
    const { rows } = await fetchAllRows<Maintenance>(() => {
      let query: any = supabase.from('maintenance_records').select('*').is('deleted_at', null).order('created_at', { ascending: false }).order('id', { ascending: false });
      if (status !== 'all' && status != null) {
        query = query.in('status', getMaintenanceStatusVariants(normalizeMaintenanceStatus(status)));
      }
      if (propertyId) query = query.eq('property_id', propertyId);
      return query;
    });
    return rows.map((row) => ({
      ...row,
      status: normalizeMaintenanceStatus(row.status) as Maintenance['status'],
      priority: normalizeMaintenancePriority(row.priority) as Maintenance['priority'],
    }));
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل طلبات الصيانة');
    throw error;
  }
}
export type CreateMaintenanceInput = {
  property_id: string;
  unit_id?: string | null;
  service_provider_id?: string | null;
  service_provider_category_id?: string | null;
  title: string;
  description?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string | null;
  technician_name?: string | null;
  scheduled_date?: string | null;
  attachment_url?: string | null;
};

export type CreateMaintenanceAtomicResult = {
  maintenance: Maintenance;
  idempotent: boolean;
};

/**
 * Creates a maintenance request through the server-controlled
 * `public.create_maintenance_atomic` RPC. The RPC enforces:
 *   - active-company and property scoping,
 *   - unit belongs to the same property,
 *   - non-empty title after trim,
 *   - priority enum validation,
 *   - idempotency on `request_id` (a fresh UUID is generated per call,
 *     so retries are safe),
 *   - audit trail entry.
 *
 * The raw `.from('maintenance_records').insert(...)` path that was here
 * before this change is removed intentionally: a frontend raw insert
 * cannot satisfy any of the above, and the matching RLS tightening
 * (in the migration) blocks it.
 */
export async function createMaintenance(
  input: CreateMaintenanceInput,
): Promise<Maintenance> {
  const requestId = crypto.randomUUID();
  const { data, error } = await supabase
    .rpc('create_maintenance_atomic', {
      p_property_id: input.property_id,
      p_unit_id: input.unit_id ?? null,
      p_title: input.title,
      p_description: input.description ?? null,
      p_priority: input.priority,
      p_assigned_to: input.assigned_to ?? null,
      p_technician_name: input.technician_name ?? null,
      p_scheduled_date: input.scheduled_date ?? null,
      p_attachment_url: input.attachment_url ?? null,
      p_request_id: requestId,
      p_service_provider_category_id: input.service_provider_category_id ?? null,
      p_service_provider_id: input.service_provider_id ?? null,
    })
    .single();
  if (error) handleSupabaseError(error, 'تعذر إنشاء طلب الصيانة');
  const payload = (data ?? {}) as { maintenance?: Maintenance } & Partial<CreateMaintenanceAtomicResult>;
  if (!payload.maintenance) {
    throw new Error('استجابة الخادم لا تحتوي على سجل الصيانة المنشأ');
  }
  return payload.maintenance;
}

export async function updateMaintenance(requestId: string, payload: MaintenanceUpdate) {
  const { data, error } = await supabase
    .from('maintenance_records')
    .update(payload)
    .eq('id', requestId)
    .is('deleted_at', null)
    .select('*')
    .single()
    .returns<Maintenance>();
  if (error) handleSupabaseError(error, 'تعذر تعديل طلب الصيانة');
  return data;
}

/**
 * R8: every status transition is a SERVER COMMAND
 * (transition_maintenance_status_atomic) — never a raw table update. The
 * server enforces the legal matrix (open→in_progress/cancelled,
 * in_progress→open/resolved/cancelled, resolved→closed, terminal states immutable),
 * requires a cancellation reason, and audits the transition.
 */
export async function updateMaintenanceStatus(
  requestId: string,
  status: Exclude<MaintenanceStatus, 'all'>,
  reason?: string,
) {
  const { data, error } = await supabase.rpc('transition_maintenance_status_atomic', {
    p_request_id: requestId,
    p_next_status: status,
    p_reason: reason ?? null,
  });
  if (error) handleSupabaseError(error, 'تعذر تحديث حالة طلب الصيانة');
  return data as Maintenance;
}

export type CloseMaintenanceInput = {
  requestId: string;
  cost: number;
  chargedTo: 'OWNER' | 'TENANT' | 'COMPANY';
  notes: string | null;
  evidenceUrl: string | null;
  confirmed: boolean;
};
export type CloseMaintenanceResult = { maintenance: Maintenance; expense_id: string | null };

export async function closeMaintenanceWithExpense(input: CloseMaintenanceInput): Promise<CloseMaintenanceResult> {
  const { data, error } = await supabase
    .rpc('close_maintenance_with_expense', {
      p_request_id: input.requestId, p_cost: input.cost, p_charged_to: input.chargedTo,
      p_notes: input.notes, p_evidence_url: input.evidenceUrl, p_confirmed: input.confirmed,
    })
    .single();
  if (error) handleSupabaseError(error, 'تعذر إغلاق طلب الصيانة وتسجيل التكلفة');
  return data as unknown as CloseMaintenanceResult;
}
