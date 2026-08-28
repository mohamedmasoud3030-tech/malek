import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  appPermissions,
  getAuthorizationContextFromSession,
  type AppPermission,
  type AuthorizationContext,
} from './permissions';

export const EFFECTIVE_PERMISSIONS_CHANGED_EVENT = 'malek:effective-permissions-changed';

function isAppPermission(value: unknown): value is AppPermission {
  return typeof value === 'string' && (appPermissions as readonly string[]).includes(value);
}

/**
 * Loads the server-computed effective set. This is deliberately not a direct
 * user_permission_grants read: owner overrides may deny a legacy role-derived
 * capability or allow a capability to a routine Employee, and both decisions
 * must be reflected identically in navigation, route guards and server RPCs.
 */
export async function loadGrantedPermissions(_userId: string): Promise<readonly AppPermission[]> {
  const { data, error } = await (supabase as any).rpc('list_my_effective_app_permissions');
  if (error) throw error;
  return Array.from(new Set(
    ((data ?? []) as Array<{ permission?: unknown }>)
      .map((row) => row.permission)
      .filter(isAppPermission),
  ));
}

export async function getEffectiveAuthorizationContextFromSession(
  session: Pick<Session, 'user' | 'access_token'> | null | undefined,
): Promise<AuthorizationContext | null> {
  const base = getAuthorizationContextFromSession(session);
  if (!base) return null;
  const grantedPermissions = await loadGrantedPermissions(base.userId);
  return { ...base, grantedPermissions, effectivePermissionsResolved: true };
}

export function announceEffectivePermissionsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EFFECTIVE_PERMISSIONS_CHANGED_EVENT));
  }
}
