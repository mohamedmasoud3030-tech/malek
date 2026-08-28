export type OwnerPortalAuthorization =
  | Readonly<{ authorized: true; token: string }>
  | Readonly<{ authorized: false; reason: 'OWNER_LINK_MISSING' | 'OWNER_LINK_MALFORMED' }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The owner portal accepts one credential only: the exported bearer token.
 * Owner/company ids from the URL are intentionally ignored and never trusted.
 */
export function resolveOwnerPortalAuthorization(token: string | null | undefined): OwnerPortalAuthorization {
  const normalized = token?.trim();
  if (!normalized) return { authorized: false, reason: 'OWNER_LINK_MISSING' };
  if (!UUID_PATTERN.test(normalized)) return { authorized: false, reason: 'OWNER_LINK_MALFORMED' };
  return { authorized: true, token: normalized };
}
