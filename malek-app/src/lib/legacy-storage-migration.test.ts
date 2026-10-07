// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { migrateLegacyStorageKeys } from './legacy-storage-migration';

describe('legacy browser storage migration', () => {
  it('moves existing values to MALEK keys without overwriting newer values', () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem('rentrix-auth-session', 'legacy-session');
    storage.setItem('rentrix-theme', 'light');
    storage.setItem('malek-assistant-auto-speak', 'false');
    storage.setItem('rentrix-assistant-auto-speak', 'true');
    storage.setItem('rentrix.pwa-install-dismissed-at', '123');
    storage.setItem('rentrix-landing-lang', 'ar');

    migrateLegacyStorageKeys(storage);

    expect(storage.getItem('malek-auth-session')).toBe('legacy-session');
    expect(storage.getItem('malek-theme')).toBe('light');
    expect(storage.getItem('malek-assistant-auto-speak')).toBe('false');
    expect(storage.getItem('malek.pwa-install-dismissed-at')).toBe('123');
    expect(storage.getItem('malek-landing-lang')).toBe('ar');
    expect(storage.getItem('rentrix-auth-session')).toBeNull();
    expect(storage.getItem('rentrix-theme')).toBeNull();
    expect(storage.getItem('rentrix-assistant-auto-speak')).toBeNull();
    expect(storage.getItem('rentrix.pwa-install-dismissed-at')).toBeNull();
    expect(storage.getItem('rentrix-landing-lang')).toBeNull();
  });

  it('logs migration errors without exposing stored values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      getItem: () => {
        throw new DOMException('Denied', 'SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(() => migrateLegacyStorageKeys(storage)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('legacy-session');
  });
});
