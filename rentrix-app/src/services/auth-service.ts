import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

import { clearStoredSession } from '@/features/auth/session-storage';

export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // Invalid or expired token - return null to trigger redirect to login without loop.
      // If the stored refresh token itself is corrupted (e.g. malformed
      // base64 left over from a stale/shared storage key across preview
      // deployments), it will keep failing on every reload unless we clear
      // it here.
      console.warn('getCurrentSession error, treating as no session:', error.message);
      clearStoredSession();
      return null;
    }
    if (!data.session) return null;

    // getSession() restores the locally persisted session but does not prove
    // that the access token is still accepted by the Auth service/PostgREST.
    // A stale access token can therefore unlock the app shell and produce a
    // cascade of 401s on every data request. Refresh once during bootstrap so
    // a valid refresh token repairs the session before protected queries run.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      console.warn('Session refresh failed during bootstrap; clearing stored session.', refreshError?.message);
      clearStoredSession();
      return null;
    }

    return refreshed.session;
  } catch (err) {
    console.warn('getCurrentSession exception, treating as no session:', err);
    clearStoredSession();
    return null;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Prefer global sign-out while online. If the network cannot reach Auth, clear
 * the browser session locally as a shared-device safety boundary; a stale local
 * token must never keep a previous operator signed in.
 */
export async function signOut(): Promise<'remote' | 'local'> {
  let remoteError: unknown;
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      clearStoredSession();
      return 'remote';
    }
    remoteError = error;
  } catch (error) {
    remoteError = error;
  }

  // The SDK may reject rather than return an error (network/storage adapters).
  // Always attempt SDK cleanup as well as removing the persisted session.
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } finally {
    clearStoredSession();
  }

  console.warn('Remote sign-out failed; cleared this browser session locally.', remoteError);
  return 'local';
}
