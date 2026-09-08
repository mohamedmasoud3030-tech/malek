/** Persisted key is a compatibility contract; do not rename without migration. */
export const AUTH_STORAGE_KEY = 'rentrix-auth-session';

/** Best-effort persisted-session cleanup, including unavailable browser storage. */
export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Privacy mode or denied storage must not prevent the logout UI transition.
  }
}
