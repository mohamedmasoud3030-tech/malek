import { LEGACY_AUTH_STORAGE_KEY, migrateLegacyStorageKeys } from '@/lib/legacy-storage-migration';

export const AUTH_STORAGE_KEY = 'malek-auth-session';

if (typeof window !== 'undefined') {
  try {
    migrateLegacyStorageKeys(window.localStorage);
  } catch (error) {
    console.warn('Unable to migrate saved MALEK browser preferences.', error);
  }
}

/** Best-effort persisted-session cleanup, including unavailable browser storage. */
export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // Privacy mode or denied storage must not prevent the logout UI transition.
  }
}
