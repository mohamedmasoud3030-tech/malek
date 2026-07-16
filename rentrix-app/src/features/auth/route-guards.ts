import { redirect } from '@tanstack/react-router';
import type { Session } from '@supabase/supabase-js';
import { canAccess, getAuthorizationContextFromSession, type AppPermission } from './permissions';

export function assertSessionPermission(session: Pick<Session, 'user'> | null | undefined, permission: AppPermission): void {
  if (!canAccess(getAuthorizationContextFromSession(session), permission)) {
    throw redirect({ to: '/dashboard' });
  }
}

