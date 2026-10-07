import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
const clearStoredSession = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { auth: authMocks } }));
vi.mock('@/features/auth/session-storage', () => ({ clearStoredSession }));

import { getCurrentSession } from './auth-service';

describe('getCurrentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the restored session supplied by the auth SDK', async () => {
    const session = { access_token: 'restored', user: { id: 'user-1' } };
    authMocks.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(getCurrentSession()).resolves.toBe(session);
    expect(authMocks.getSession).toHaveBeenCalledTimes(1);
    expect(clearStoredSession).not.toHaveBeenCalled();
  });

  it('shares concurrent lookups so restoration and SDK refresh are single-flight', async () => {
    let resolveSession!: (value: unknown) => void;
    authMocks.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    const first = getCurrentSession();
    const second = getCurrentSession();
    expect(authMocks.getSession).toHaveBeenCalledTimes(1);

    const session = { access_token: 'refreshed', user: { id: 'user-1' } };
    resolveSession({ data: { session }, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([session, session]);
  });

  it('clears an invalid session after an auth 401 and returns no session', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: { status: 401, message: 'Invalid Refresh Token' } });

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(clearStoredSession).toHaveBeenCalledTimes(1);
  });
});
