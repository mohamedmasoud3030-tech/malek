/**
 * Decode app_metadata from a Supabase access token for client-side display or
 * tenant scoping. This is decoding only: it does not validate a JWT signature
 * and must never replace server-side authorization.
 */
export function readAccessTokenAppMetadata(
  accessToken: string | null | undefined,
): Readonly<Record<string, unknown>> | null {
  if (!accessToken) return null;
  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
    const appMetadata = (claims as Record<string, unknown>).app_metadata;
    if (!appMetadata || typeof appMetadata !== 'object' || Array.isArray(appMetadata)) return null;
    return appMetadata as Readonly<Record<string, unknown>>;
  } catch {
    return null;
  }
}
