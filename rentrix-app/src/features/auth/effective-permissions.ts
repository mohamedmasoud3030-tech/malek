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
 * One data seam for navigation, AuthProvider and route guards. RLS scopes the
 * read to the active company and current user; malformed/unknown grant keys are
 * ignored fail-closed.
 */
export async function loadGrantedPermissions(userId: string): Promise<readonly AppPermission[]> {
  const { data, error } = await (supabase as any)
    .from('user_permission_grants')
    .select('permission')
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (error) throw error;
  return Array.from(new Set(
    ((data ?? []) as Array<{ permission?: unknown }>)
      .map((row) => row.permission)
      .filter(isAppPermission),
  ));
}

export async function getEffectiveAuthorizationContextFromSession(
  session: (Pick<Session, 'user'> & Partial<Pick<Session, 'access_token'>>) | null | undefined,
): Promise<AuthorizationContext | null> {
  const base = getAuthorizationContextFromSession(session as Parameters<typeof getAuthorizationContextFromSession>[0]);
  if (!base) return null;
  const grantedPermissions = await loadGrantedPermissions(base.userId);
  return { ...base, grantedPermissions };
}

export function announceEffectivePermissionsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EFFECTIVE_PERMISSIONS_CHANGED_EVENT));
  }
}
