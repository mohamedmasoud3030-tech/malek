import { supabase } from '@/lib/supabase';
import { resolveTenantPortalAuthorization } from './tenant-portal-authority';
import type { TenantPortalLoadResult, TenantPortalSnapshot } from './tenant-portal-read-model';

type TenantPortalRpcPayload =
  | { status: 'ready'; snapshot: TenantPortalSnapshot }
  | { status: 'invalid' };

/**
 * Sole browser data seam for the isolated Tenant Portal. The browser sends
 * only the bearer token. Company and tenant scope are resolved server-side
 * from the private link table; no office session, role or record id is trusted.
 */
export async function loadTenantPortalSnapshot(token: string | null | undefined): Promise<TenantPortalLoadResult> {
  const authorization = resolveTenantPortalAuthorization(token);
  if (!authorization.authorized) {
    return {
      status: 'invalid',
      reason: authorization.reason === 'TENANT_LINK_MISSING'
        ? 'TENANT_PORTAL_LINK_REQUIRED'
        : 'TENANT_PORTAL_LINK_INVALID_OR_EXPIRED',
    };
  }

  const { data, error } = await (supabase as any).rpc('get_tenant_portal_snapshot', {
    p_token: authorization.token,
  });
  if (error) throw error;

  const payload = data as TenantPortalRpcPayload | null;
  if (!payload || payload.status !== 'ready' || !payload.snapshot) {
    return { status: 'invalid', reason: 'TENANT_PORTAL_LINK_INVALID_OR_EXPIRED' };
  }

  return { status: 'ready', snapshot: payload.snapshot };
}

/** Canonical source tables the server projection may read. */
export const TENANT_PORTAL_ALLOWED_PROJECTION_SOURCES = [
  'people',
  'units',
  'properties',
  'contracts',
  'invoices',
  'receipts',
] as const;
