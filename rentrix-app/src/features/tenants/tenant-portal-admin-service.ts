import { supabase } from '@/lib/supabase';

export type TenantPortalLink = Readonly<{
  token: string;
  expires_at: string;
}>;

/** Office-owner operation. Server validates owner role + tenant/company scope. */
export async function createTenantPortalLink(tenantId: string): Promise<TenantPortalLink> {
  const { data, error } = await (supabase as any).rpc('create_tenant_portal_link', {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return data as TenantPortalLink;
}

export async function revokeTenantPortalLink(tenantId: string): Promise<{ revoked: boolean }> {
  const { data, error } = await (supabase as any).rpc('revoke_tenant_portal_link', {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return data as { revoked: boolean };
}

export function buildTenantPortalUrl(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/tenant-portal?token=${encodeURIComponent(token)}`;
}
