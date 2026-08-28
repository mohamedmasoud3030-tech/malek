const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantPortalAuthorization =
  | Readonly<{ authorized: true; token: string }>
  | Readonly<{ authorized: false; reason: 'TENANT_LINK_MISSING' | 'TENANT_LINK_INVALID' }>;

/**
 * The URL token is the only client-side tenant credential. Tenant/company ids
 * are never accepted from the browser; the server resolves both scopes from
 * the private link table.
 */
export function resolveTenantPortalAuthorization(token: string | null | undefined): TenantPortalAuthorization {
  const normalized = token?.trim() ?? '';
  if (!normalized) return { authorized: false, reason: 'TENANT_LINK_MISSING' };
  if (!UUID_PATTERN.test(normalized)) return { authorized: false, reason: 'TENANT_LINK_INVALID' };
  return { authorized: true, token: normalized.toLowerCase() };
}
