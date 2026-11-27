// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

const authMocks = vi.hoisted(() => {
  let listener: ((event: string, session: unknown) => void) | undefined;
  const getCurrentSession = vi.fn();
  const channel: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return {
    auth: {
      onAuthStateChange: vi.fn((callback: typeof listener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    router: { state: { location: { pathname: '/dashboard' } }, navigate: vi.fn() },
    channel,
    getCurrentSession,
    emit: (event: string, session: unknown) => listener?.(event, session),
  };
});

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => authMocks.router,
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: authMocks.auth,
    channel: () => authMocks.channel,
    removeChannel: vi.fn(),
  },
}));
vi.mock('@/services/auth-service', () => ({
  getCurrentSession: authMocks.getCurrentSession,
  signInWithEmail: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/features/auth/effective-permissions', () => ({
  EFFECTIVE_PERMISSIONS_CHANGED_EVENT: 'effective-permissions-changed',
  loadGrantedPermissions: vi.fn().mockResolvedValue([]),
}));

import { AuthProvider, useAuth } from './use-auth';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('AuthProvider session bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('keeps protected children loading until session restoration resolves despite an auth event', async () => {
    const restoration = deferred<null>();
    authMocks.getCurrentSession.mockReturnValue(restoration.promise);
    const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    act(() => authMocks.emit('TOKEN_REFRESHED', null));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      restoration.resolve(null);
      await restoration.promise;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('does not let the SDK initial cache event discard verified restoration', async () => {
    const restoration = deferred<unknown>();
    authMocks.getCurrentSession.mockReturnValue(restoration.promise);
    const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    const session = { user: { id: 'user-1', app_metadata: { role: 'ADMIN' }, user_metadata: {} } };
    act(() => authMocks.emit('INITIAL_SESSION', session));
    await act(async () => { restoration.resolve(session); await restoration.promise; });
    await waitFor(() => expect(result.current.authorization?.effectivePermissionsResolved).toBe(true));
    expect(result.current.session).toBe(session);
  });

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'])('resolves permissions again for same-user %s events', async (event) => {
    const session = { user: { id: 'user-1', app_metadata: { role: 'ADMIN' }, user_metadata: {} } };
    authMocks.getCurrentSession.mockResolvedValue(session);
    const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.authorization?.effectivePermissionsResolved).toBe(true));
    act(() => authMocks.emit(event, session));
    await waitFor(() => expect(result.current.authorization?.effectivePermissionsResolved).toBe(true));
  });

  it('uses an auth event received during bootstrap instead of overwriting it with a stale restore result', async () => {
    const restoration = deferred<null>();
    authMocks.getCurrentSession.mockReturnValue(restoration.promise);
    const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    const refreshedSession = { user: { id: 'user-1', app_metadata: {}, user_metadata: {} } };

    act(() => authMocks.emit('SIGNED_IN', refreshedSession));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      restoration.resolve(null);
      await restoration.promise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.session).toBe(refreshedSession);
    expect(result.current.isAuthenticated).toBe(true);
  });
});
