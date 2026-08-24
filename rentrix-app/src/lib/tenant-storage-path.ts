import { supabase } from '@/lib/supabase';

function readCompanyIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!claims || typeof claims !== 'object') return null;
    const appMetadata = (claims as Record<string, unknown>).app_metadata;
    if (!appMetadata || typeof appMetadata !== 'object') return null;
    const companyId = (appMetadata as Record<string, unknown>).company_id;
    return typeof companyId === 'string' && companyId.length > 0 ? companyId : null;
  } catch {
    return null;
  }
}

export async function requireActiveCompanyIdForStorage(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const companyId = readCompanyIdFromAccessToken(data.session?.access_token);
  if (!companyId) throw new Error('تعذر تحديد الشركة النشطة لمسار التخزين.');
  return companyId;
}

export function buildTenantVaultPath(companyId: string, relativePath: string): string {
  const cleanRelativePath = relativePath.replace(/^\/+/, '');
  if (!companyId || companyId.includes('/') || !cleanRelativePath || cleanRelativePath.includes('..')) {
    throw new Error('مسار التخزين غير صالح.');
  }
  return `vault/${companyId}/${cleanRelativePath}`;
}
