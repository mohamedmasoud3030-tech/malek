export const LEGACY_AUTH_STORAGE_KEY = 'rentrix-auth-session';

const LEGACY_STORAGE_KEY_MIGRATIONS = [
  [LEGACY_AUTH_STORAGE_KEY, 'malek-auth-session'],
  ['rentrix-theme', 'malek-theme'],
  ['rentrix-assistant-auto-speak', 'malek-assistant-auto-speak'],
  ['rentrix.pwa-install-dismissed-at', 'malek.pwa-install-dismissed-at'],
  ['rentrix-landing-lang', 'malek-landing-lang'],
] as const;

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function migrateLegacyStorageKeys(storage: BrowserStorage): void {
  for (const [legacyKey, currentKey] of LEGACY_STORAGE_KEY_MIGRATIONS) {
    try {
      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue === null) continue;
      if (storage.getItem(currentKey) === null) {
        storage.setItem(currentKey, legacyValue);
      }
      storage.removeItem(legacyKey);
    } catch (error) {
      console.warn(`Unable to migrate stored MALEK preference for ${currentKey}.`, error);
    }
  }
}
