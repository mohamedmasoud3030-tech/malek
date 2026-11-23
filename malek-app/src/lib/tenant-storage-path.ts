import { supabase } from '@/lib/supabase';
import { readAccessTokenAppMetadata } from './access-token-claims';

export async function requireActiveCompanyIdForStorage(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const companyId = readAccessTokenAppMetadata(data.session?.access_token)?.company_id;
  const resolvedCompanyId = typeof companyId === 'string' && companyId.length > 0 ? companyId : null;
  if (!resolvedCompanyId) throw new Error('تعذر تحديد الشركة النشطة لمسار التخزين.');
  return resolvedCompanyId;
}

export function buildTenantVaultPath(companyId: string, relativePath: string): string {
  const cleanRelativePath = relativePath.replace(/^\/+/, '');
  if (!companyId || companyId.includes('/') || !cleanRelativePath || cleanRelativePath.includes('..')) {
    throw new Error('مسار التخزين غير صالح.');
  }
  return `vault/${companyId}/${cleanRelativePath}`;
}
