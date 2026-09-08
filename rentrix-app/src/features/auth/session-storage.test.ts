// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, clearStoredSession } from './session-storage';

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('session persistence compatibility', () => {
  it('removes only the historical auth key, not unrelated company preferences', () => {
    expect(AUTH_STORAGE_KEY).toBe('rentrix-auth-session');
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'session');
    window.localStorage.setItem('company-preference', 'keep');
    clearStoredSession();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('company-preference')).toBe('keep');
  });

  it('does not prevent logout when storage access is denied', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    expect(clearStoredSession).not.toThrow();
  });
});
