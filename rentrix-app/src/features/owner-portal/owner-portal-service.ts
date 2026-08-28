import { supabase } from '@/lib/supabase';
import { resolveOwnerPortalAuthorization } from './owner-portal-authority';
import type { OwnerPortalLoadResult, OwnerPortalSnapshot } from './owner-portal-read-model';

type OwnerPortalRpcPayload =
  | { status: 'ready'; snapshot: OwnerPortalSnapshot }
  | { status: 'invalid' };

/**
 * Sole browser data seam for the isolated Owner Portal.
 * The browser supplies only the exported bearer token; company and owner scope
 * are resolved server-side from the private link row.
 */
export async function loadOwnerPortalSnapshot(token: string | null | undefined): Promise<OwnerPortalLoadResult> {
  const authorization = resolveOwnerPortalAuthorization(token);
  if (!authorization.authorized) {
    return {
      status: 'invalid',
      reason: authorization.reason === 'OWNER_LINK_MISSING'
        ? 'OWNER_PORTAL_LINK_REQUIRED'
        : 'OWNER_PORTAL_LINK_INVALID_OR_EXPIRED',
    };
  }

  const { data, error } = await (supabase as any).rpc('get_owner_portal_snapshot', {
    p_token: authorization.token,
  });
  if (error) throw error;

  const payload = data as OwnerPortalRpcPayload | null;
  if (!payload || payload.status !== 'ready' || !payload.snapshot) {
    return { status: 'invalid', reason: 'OWNER_PORTAL_LINK_INVALID_OR_EXPIRED' };
  }

  return { status: 'ready', snapshot: payload.snapshot };
}

/** Canonical source tables permitted in the server-side owner projection. */
export const OWNER_PORTAL_ALLOWED_PROJECTION_SOURCES = [
  'owners',
  'property_owners',
  'properties',
  'units',
  'contracts',
  'owner_settlements',
  'maintenance_records',
  'attachments',
] as const;
