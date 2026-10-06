// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, clearStoredSession } from './session-storage';
import { migrateLegacyStorageKeys } from '@/lib/legacy-storage-migration';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('session persistence compatibility', () => {
  it('uses the MALEK key and clears only auth state on logout', () => {
    expect(AUTH_STORAGE_KEY).toBe('malek-auth-session');
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'session');
    window.localStorage.setItem('company-preference', 'keep');
    clearStoredSession();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('company-preference')).toBe('keep');
  });

  it('migrates the previously persisted auth session before it is read', () => {
    window.localStorage.setItem('rentrix-auth-session', 'session');
    migrateLegacyStorageKeys(window.localStorage);
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe('session');
    expect(window.localStorage.getItem('rentrix-auth-session')).toBeNull();
  });

  it('does not prevent logout when storage access is denied', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    expect(clearStoredSession).not.toThrow();
  });
});
