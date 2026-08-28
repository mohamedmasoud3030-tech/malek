import { supabase } from '@/lib/supabase';
import { announceEffectivePermissionsChanged } from './effective-permissions';
import type { AppPermission } from './permissions';

export type PermissionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PermissionRequest = Readonly<{
  id: string;
  requester_user_id: string;
  requester_name?: string | null;
  requester_email?: string | null;
  permission: AppPermission;
  resource_route: string | null;
  reason: string;
  status: PermissionRequestStatus;
  reviewer_user_id: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
  /** Historical approval is distinct from a currently active grant. */
  grant_active?: boolean;
}>;

export type EmployeeEffectivePermission = Readonly<{
  user_id: string;
  permission: AppPermission;
  allowed: boolean;
  explicitly_set: boolean;
}>;

export async function requestPermission(permission: AppPermission, resourceRoute: string | null, reason: string) {
  const { data, error } = await (supabase as any).rpc('request_permission', {
    p_permission: permission,
    p_resource_route: resourceRoute,
    p_reason: reason,
  });
  if (error) throw error;
  return data as PermissionRequest;
}

export async function listMyPermissionRequests() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return [];
  const { data, error } = await (supabase as any)
    .from('permission_requests')
    .select('*')
    .eq('requester_user_id', authData.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const requests = (data ?? []) as PermissionRequest[];
  const { data: grants, error: grantsError } = await (supabase as any)
    .from('user_permission_grants')
    .select('permission')
    .eq('user_id', authData.user.id)
    .is('revoked_at', null);
  if (grantsError) throw grantsError;
  const activePermissions = new Set((grants ?? []).map((grant: { permission?: string }) => grant.permission));
  return requests.map((request) => ({
    ...request,
    grant_active: activePermissions.has(request.permission),
  }));
}

export async function listPermissionRequestsForReview(status?: PermissionRequestStatus) {
  const { data, error } = await (supabase as any).rpc('list_permission_requests_for_review', {
    p_status: status ?? null,
  });
  if (error) throw error;
  return (data ?? []) as PermissionRequest[];
}

/** Owner-only projection of the effective employee capability matrix. */
export async function listEmployeeEffectivePermissions(): Promise<EmployeeEffectivePermission[]> {
  const { data, error } = await (supabase as any).rpc('list_employee_effective_permissions');
  if (error) throw error;
  return (data ?? []) as EmployeeEffectivePermission[];
}

/**
 * Owner-authored ALLOW/DENY. This is an authoritative override, not merely an
 * additive grant, so it can also switch off access inherited from a legacy
 * MANAGER/ACCOUNTANT/OPERATIONS/VIEWER role.
 */
export async function setEmployeePermission(
  userId: string,
  permission: AppPermission,
  allowed: boolean,
  reason = 'تحديد صلاحيات الموظف بواسطة صاحب المكتب',
) {
  const { data, error } = await (supabase as any).rpc('set_employee_permission', {
    p_user_id: userId,
    p_permission: permission,
    p_allowed: allowed,
    p_reason: reason,
  });
  if (error) throw error;
  announceEffectivePermissionsChanged();
  return data as { user_id: string; permission: AppPermission; allowed: boolean };
}

/** @deprecated Use the audience-specific list function. */
export const listPermissionRequests = listMyPermissionRequests;

export async function decidePermissionRequest(
  id: string,
  decision: Exclude<PermissionRequestStatus, 'PENDING'>,
  reason: string,
) {
  const { data, error } = await (supabase as any).rpc('decide_permission_request', {
    p_request_id: id,
    p_decision: decision,
    p_reason: reason.trim() || null,
  });
  if (error) throw error;
  announceEffectivePermissionsChanged();
  return data as PermissionRequest;
}

export async function revokePermissionGrant(userId: string, permission: AppPermission, reason: string) {
  const { data, error } = await (supabase as any).rpc('revoke_permission_grant', {
    p_user_id: userId,
    p_permission: permission,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  announceEffectivePermissionsChanged();
  return data as { revoked: boolean };
}
