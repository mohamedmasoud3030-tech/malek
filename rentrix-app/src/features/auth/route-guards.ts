import { redirect } from '@tanstack/react-router';
import type { Session } from '@supabase/supabase-js';
import { canAccess, type AppPermission } from './permissions';
import { getEffectiveAuthorizationContextFromSession } from './effective-permissions';

export async function assertSessionPermission(
  session: Pick<Session, 'user'> | null | undefined,
  permission: AppPermission,
): Promise<void> {
  const authorization = await getEffectiveAuthorizationContextFromSession(session);
  if (!canAccess(authorization, permission)) {
    throw redirect({ to: '/dashboard' });
  }
}

