// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth },
}));

import { getCurrentSession, signInWithEmail, signOut } from './auth-service';

describe('auth service session lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('rentrix-auth-session', '{"access_token":"stale"}');
  });

  it('returns the live session when Auth succeeds', async () => {
    const session = { access_token: 'ok', user: { id: 'user-1' } };
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(getCurrentSession()).resolves.toEqual(session);
    expect(window.localStorage.getItem('rentrix-auth-session')).toBe('{"access_token":"stale"}');
  });

  it('clears a corrupted stored session and fails closed', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid Refresh Token' } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(window.localStorage.getItem('rentrix-auth-session')).toBeNull();
    warn.mockRestore();
  });

  it('clears storage when getSession throws', async () => {
    auth.getSession.mockRejectedValue(new Error('storage unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(window.localStorage.getItem('rentrix-auth-session')).toBeNull();
    warn.mockRestore();
  });

  it('signs in with email/password and surfaces Auth errors', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    await expect(signInWithEmail('a@b.test', 'secret')).resolves.toEqual({ session: { access_token: 't' } });

    auth.signInWithPassword.mockResolvedValue({ data: null, error: new Error('Invalid login credentials') });
    await expect(signInWithEmail('a@b.test', 'bad')).rejects.toThrow('Invalid login credentials');
  });

  it('signs out through the Auth API', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledTimes(1);

    auth.signOut.mockResolvedValue({ error: new Error('network') });
    await expect(signOut()).rejects.toThrow('network');
  });
});
