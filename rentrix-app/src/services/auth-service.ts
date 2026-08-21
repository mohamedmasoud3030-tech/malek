import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const AUTH_STORAGE_KEY = 'rentrix-auth-session';

function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (privacy mode, etc.) - safe to ignore.
  }
}

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
    return data.session;
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
  const { error } = await supabase.auth.signOut();
  if (!error) {
    clearStoredSession();
    return 'remote';
  }

  const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
  clearStoredSession();
  if (localError) throw localError;

  console.warn('Remote sign-out failed; cleared this browser session locally.', error.message);
  return 'local';
}
