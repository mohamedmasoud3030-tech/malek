import type { AuthError, Session } from '@supabase/supabase-js';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

import { clearStoredSession } from '@/features/auth/session-storage';

let currentSessionLookup: Promise<Session | null> | null = null;

/**
 * Auth codes that mean the server has positively decided the credential is
 * unusable. Anything not listed here — and anything that never reached the
 * server at all — is not a decision, and must never destroy a session.
 */
const REVOKED_SESSION_CODES = new Set([
  'bad_jwt',
  'session_not_found',
  'session_missing',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'invalid_refresh_token',
  'user_not_found',
]);

/**
 * `rejected` — the Auth server answered and refused the token.
 * `unverifiable` — no answer (offline, timeout, 5xx, throttling): nothing was proven.
 */
type TokenVerdict = 'accepted' | 'rejected' | 'unverifiable';

function isRevokedSession(error: AuthError): boolean {
  // A transport failure is not a decision about the credential.
  if (isAuthRetryableFetchError(error)) return false;
  if (error.status === 401 || error.status === 403) return true;
  return typeof error.code === 'string' && REVOKED_SESSION_CODES.has(error.code);
}

/**
 * Prove the restored access token is still accepted by the Auth server.
 *
 * `getSession()` only compares `expires_at` with the local clock: a token the
 * server has since revoked (signed out elsewhere, rotated secret, deleted user)
 * still looks valid and unlocks the authenticated shell, after which every
 * PostgREST request answers 401. Asking `/user` forces the server to rule on
 * the exact token the browser is holding.
 */
async function verifyRestoredSession(): Promise<TokenVerdict> {
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return 'accepted';
  if (error && isRevokedSession(error)) return 'rejected';
  return 'unverifiable';
}

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
    if (!data.session) return null;

    const verdict = await verifyRestoredSession();
    if (verdict === 'accepted') return data.session;

    if (verdict === 'unverifiable') {
      // The server gave no answer, so nothing was proven in either direction.
      // Destroying the session here would sign an operator out over a flaky
      // network; reads are paused while offline (app/providers/query-client.ts)
      // and the next bootstrap runs this check again.
      console.warn('Could not verify the restored session against the Auth server; keeping it for now.');
      return data.session;
    }

    // The server refused the token. A refresh is the only repair a browser has:
    // it either returns a token the server has just issued, or proves that the
    // refresh token is dead as well.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session) return refreshed.session;

    if (refreshError && !isRevokedSession(refreshError)) {
      // Refused token, unreachable repair. Fail closed for the shell without
      // clearing storage, so a reload can recover without re-authentication.
      console.warn('Session refresh could not complete; failing closed without clearing storage.', refreshError.message);
      return null;
    }

    console.warn('Session is no longer accepted by Auth; clearing the stored session.', refreshError?.message);
    clearStoredSession();
    return null;
  } catch (err) {
    console.warn('getCurrentSession exception, treating as no session:', err);
    clearStoredSession();
    return null;
  }
}

/** Share simultaneous guard/bootstrap reads so the auth SDK performs at most one
 * restoration/verification pass for the same in-flight session lookup. */
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
