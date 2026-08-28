/**
 * Tenant Portal v1 authorization contract — P4 Intelligence & Communication.
 *
 * Canonical boundary (Document 5, "Tenant Portal trust boundary"):
 *   "Tenant Portal is a separate constrained surface. It reuses the canonical
 *    backend/domain sources but requires tenant-specific authorization in
 *    addition to company isolation. Office-shell permissions and mere
 *    knowledge of a record ID are never sufficient tenant-portal
 *    authorization."
 *
 * This module owns ONLY that authorization decision:
 *   - it is pure and side-effect free;
 *   - it fails closed on every malformed, missing, or cross-scope claim;
 *   - it never grants access from an office role or a bare record id;
 *   - the actual claim source (future upstream tenant authorization read
 *     model / RPC) is deliberately NOT consumed here, because that read model
 *     does not exist yet. Until it does, `resolveTenantPortalAuthorization`
 *     returns the deferred denial below — no fabricated access.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantPortalDeniedReason =
  | 'NO_SESSION'
  | 'TENANT_AUTHORIZATION_UNAVAILABLE'
  | 'TENANT_CLAIM_INVALID';

export type TenantPortalAuthorization =
  | Readonly<{ authorized: true; companyId: string; tenantId: string }>
  | Readonly<{ authorized: false; reason: TenantPortalDeniedReason }>;

/** Marker required by the future upstream tenant authorization claim. */
export const TENANT_PORTAL_CLAIM_SOURCE = 'tenant_portal_authorization';

/**
 * Shape of the upstream authorization claim the portal will consume once the
 * tenant-specific authorization read model lands (P1/P2/P3 lane). The portal
 * never consults `company_members`, JWT office roles, or record ids.
 */
export type TenantPortalClaim = Readonly<{
  source: typeof TENANT_PORTAL_CLAIM_SOURCE;
  companyId: string;
  tenantId: string;
}>;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

/**
 * Evaluate a tenant authorization claim.
 *
 * Fail closed: a claim is valid only when it carries the exact portal source
 * marker and two well-formed UUID scopes. Cross-scope, malformed, or
 * unspecified claims are denied — never partially trusted.
 */
export function evaluateTenantPortalClaim(claim: unknown): TenantPortalAuthorization {
  if (!claim || typeof claim !== 'object') {
    return { authorized: false, reason: 'TENANT_CLAIM_INVALID' };
  }
  const candidate = claim as Partial<TenantPortalClaim>;
  if (candidate.source !== TENANT_PORTAL_CLAIM_SOURCE) {
    return { authorized: false, reason: 'TENANT_CLAIM_INVALID' };
  }
  if (!isUuid(candidate.companyId) || !isUuid(candidate.tenantId)) {
    return { authorized: false, reason: 'TENANT_CLAIM_INVALID' };
  }
  return {
    authorized: true,
    companyId: candidate.companyId.trim(),
    tenantId: candidate.tenantId.trim(),
  };
}

/**
 * Resolve portal access for the current session.
 *
 * The upstream tenant authorization read model is NOT available yet, so this
 * currently resolves to the deferred denial. It is intentionally a single
 * function — when the upstream model lands, only this function changes; the
 * page and the read-only scope stay identical.
 */
export function resolveTenantPortalAuthorization(
  hasSession: boolean,
  claim?: unknown,
): TenantPortalAuthorization {
  if (!hasSession) return { authorized: false, reason: 'NO_SESSION' };
  if (claim === undefined) {
    return { authorized: false, reason: 'TENANT_AUTHORIZATION_UNAVAILABLE' };
  }
  return evaluateTenantPortalClaim(claim);
}
