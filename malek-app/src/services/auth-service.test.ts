import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

const authMocks = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), refreshSession: vi.fn() }));
const clearStoredSession = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { auth: authMocks } }));
vi.mock('@/features/auth/session-storage', () => ({ clearStoredSession }));

import { getCurrentSession } from './auth-service';

const restoredSession = { access_token: 'restored', refresh_token: 'r1', user: { id: 'user-1' } };
const repairedSession = { access_token: 'repaired', refresh_token: 'r2', user: { id: 'user-1' } };
const acceptedUser = { id: 'user-1' };

function revokedToken() {
  return new AuthApiError('invalid JWT: token is expired', 401, 'bad_jwt');
}
function revokedRefresh() {
  return new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found');
}
function offline() {
  return new AuthRetryableFetchError('Failed to fetch', 0);
}

describe('getCurrentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ data: { session: restoredSession }, error: null });
    authMocks.getUser.mockResolvedValue({ data: { user: acceptedUser }, error: null });
    authMocks.refreshSession.mockResolvedValue({ data: { session: repairedSession }, error: null });
  });

  it('returns a restored session whose token the Auth server still accepts', async () => {
    await expect(getCurrentSession()).resolves.toBe(restoredSession);

    expect(authMocks.getSession).toHaveBeenCalledTimes(1);
    expect(authMocks.getUser).toHaveBeenCalledTimes(1);
    // A token the server accepted is used as-is; rotating it on every load
    // would invalidate the copy held by other tabs for no benefit.
    expect(authMocks.refreshSession).not.toHaveBeenCalled();
    expect(clearStoredSession).not.toHaveBeenCalled();
  });

  it('repairs a session whose token the server rejected', async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: revokedToken() });

    await expect(getCurrentSession()).resolves.toBe(repairedSession);
    expect(authMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(clearStoredSession).not.toHaveBeenCalled();
  });

  it('clears the session when the server rejects both the access and the refresh token', async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: revokedToken() });
    authMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: revokedRefresh() });

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(clearStoredSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the Auth server cannot be reached at all', async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: offline() });

    // No answer is not a refusal: a flaky network must not sign an operator out.
    await expect(getCurrentSession()).resolves.toBe(restoredSession);
    expect(authMocks.refreshSession).not.toHaveBeenCalled();
    expect(clearStoredSession).not.toHaveBeenCalled();
  });

  it('fails closed without clearing storage when the repair path is unreachable', async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: revokedToken() });
    authMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: offline() });

    await expect(getCurrentSession()).resolves.toBeNull();
    // The shell must not open on a token the server refused, but the stored
    // session survives so a reload can recover without re-authentication.
    expect(clearStoredSession).not.toHaveBeenCalled();
  });

  it('clears an invalid session after an auth 401 from getSession and returns no session', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: { status: 401, message: 'Invalid Refresh Token' } });

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(clearStoredSession).toHaveBeenCalledTimes(1);
    expect(authMocks.getUser).not.toHaveBeenCalled();
  });

  it('returns no session without calling the server when nothing is stored', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(authMocks.getUser).not.toHaveBeenCalled();
    expect(clearStoredSession).not.toHaveBeenCalled();
  });

  it('shares concurrent lookups so restoration and verification run single-flight', async () => {
    let resolveUser!: (value: unknown) => void;
    authMocks.getUser.mockReturnValue(new Promise((resolve) => { resolveUser = resolve; }));

    const first = getCurrentSession();
    const second = getCurrentSession();
    expect(authMocks.getSession).toHaveBeenCalledTimes(1);
    // Verification starts after the stored session resolves.
    await vi.waitFor(() => expect(authMocks.getUser).toHaveBeenCalledTimes(1));

    resolveUser({ data: { user: acceptedUser }, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([restoredSession, restoredSession]);
  });
});
