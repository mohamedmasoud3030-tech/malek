/**
 * Tenant Portal v1 service boundary.
 *
 * The portal reads only through this boundary. Today the canonical
 * tenant-specific authorization read model (portal claim + company/tenant
 * scoped snapshot) is not yet available upstream, so every call returns the
 * explicit deferred result — the portal UI never guesses, never fabricates
 * data, and never falls back to office queries.
 *
 * Integration point for the upstream lane:
 *   - authorize via `resolveTenantPortalAuthorization` (claim source
 *     `tenant_portal_authorization`);
 *   - load the snapshot via the canonical read RPC for the claimed
 *     (company_id, tenant_id) only;
 *   - keep this module the only place the portal touches Supabase.
 */

import type { TenantPortalLoadResult } from './tenant-portal-read-model';

export const TENANT_PORTAL_READ_MODEL_UNAVAILABLE =
  'TENANT_PORTAL_READ_MODEL_UNAVAILABLE' as const;

export async function loadTenantPortalSnapshot(): Promise<TenantPortalLoadResult> {
  return {
    status: 'deferred',
    reason: TENANT_PORTAL_READ_MODEL_UNAVAILABLE,
  };
}

/**
 * Canonical sources the portal read model is allowed to project (documentation
 * of the v1 contract). The portal must never expose office-core records or
 * write to any of them; the upstream read RPC enforces the same scoping.
 */
export const TENANT_PORTAL_ALLOWED_PROJECTION_SOURCES = [
  'people',
  'units',
  'properties',
  'contracts',
  'invoices',
  'payments',
  'receipts',
  'receipt_allocations',
  'utility_bills',
  'maintenance_requests',
] as const;
