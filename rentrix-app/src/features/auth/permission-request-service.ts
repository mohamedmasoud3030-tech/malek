import { supabase } from '@/lib/supabase';
import type { AppPermission } from './permissions';

export type PermissionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PermissionRequest = Readonly<{ id: string; requester_user_id: string; permission: AppPermission; resource_route: string | null; reason: string; status: PermissionRequestStatus; reviewer_user_id: string | null; decided_at: string | null; decision_reason: string | null; created_at: string }>;

export async function requestPermission(permission: AppPermission, resourceRoute: string | null, reason: string) {
  const { data, error } = await (supabase as any).rpc('request_permission', { p_permission: permission, p_resource_route: resourceRoute, p_reason: reason });
  if (error) throw error;
  return data as PermissionRequest;
}

export async function listPermissionRequests(status?: PermissionRequestStatus) {
  let query = (supabase as any).from('permission_requests').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PermissionRequest[];
}

export async function decidePermissionRequest(id: string, decision: Exclude<PermissionRequestStatus, 'PENDING'>, reason: string) {
  const { data, error } = await (supabase as any).rpc('decide_permission_request', { p_request_id: id, p_decision: decision, p_reason: reason || null });
  if (error) throw error;
  return data as PermissionRequest;
}
