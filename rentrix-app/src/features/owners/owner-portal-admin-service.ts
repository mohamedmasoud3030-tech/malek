import { supabase } from '@/lib/supabase';

export type OwnerPortalLink = Readonly<{
  token: string;
  expires_at: string;
}>;

export async function createOwnerPortalLink(ownerId: string): Promise<OwnerPortalLink> {
  const { data, error } = await (supabase as any).rpc('create_owner_portal_link', {
    p_owner_id: ownerId,
  });
  if (error) throw error;
  return data as OwnerPortalLink;
}

export async function revokeOwnerPortalLink(ownerId: string): Promise<{ revoked: boolean }> {
  const { data, error } = await (supabase as any).rpc('revoke_owner_portal_link', {
    p_owner_id: ownerId,
  });
  if (error) throw error;
  return data as { revoked: boolean };
}

export function buildOwnerPortalUrl(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/owner-portal?token=${encodeURIComponent(token)}`;
}
