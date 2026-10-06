import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

import { clearStoredSession } from '@/features/auth/session-storage';

let currentSessionLookup: Promise<Session | null> | null = null;

async function readCurrentSession(): Promise<Session | null> {
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

/** Share simultaneous guard/bootstrap reads so the auth SDK performs at most one
 * restoration/expired-token refresh for the same in-flight session lookup. */
export function getCurrentSession(): Promise<Session | null> {
  if (currentSessionLookup) return currentSessionLookup;
  let lookup!: Promise<Session | null>;
  lookup = readCurrentSession().finally(() => {
    if (currentSessionLookup === lookup) currentSessionLookup = null;
  });
  currentSessionLookup = lookup;
  return lookup;
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
