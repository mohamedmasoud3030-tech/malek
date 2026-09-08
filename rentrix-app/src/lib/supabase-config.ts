/** Shared build/runtime public configuration policy. Pure: no SDK or Vite globals. */
export const SUPABASE_FALLBACK_URL = 'https://invalid.supabase.local';
export const SUPABASE_FALLBACK_KEY = 'invalid-anon-key';
const PLACEHOLDER_HOSTS = ['example.supabase.co', 'invalid.supabase.local'];
const PLACEHOLDER_KEYS = new Set(['test-anon-key', SUPABASE_FALLBACK_KEY]);

export type PublicSupabaseConfig = Readonly<{
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
  reason?: string;
  errorCode?: 'unsafe-key';
}>;

/** Check recognizable Supabase key families without authenticating the token.
 * A decoded legacy JWT is only a configuration-safety check, never a session.
 * Opaque custom gateway/test keys remain supported; their validity is server-owned.
 */
function isRecognizableNonPublicKey(key: string): boolean {
  if (key.startsWith('sb_')) {
    return !key.startsWith('sb_publishable_') || key.length <= 'sb_publishable_'.length;
  }
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload: unknown = JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/')));
    return !payload || typeof payload !== 'object' || !('role' in payload) || payload.role !== 'anon';
  } catch {
    return true;
  }
}

export function resolvePublicSupabaseConfig(url: string | undefined, key: string | undefined): PublicSupabaseConfig {
  const normalizedUrl = url?.trim() ?? '';
  const normalizedKey = key?.trim() ?? '';
  const unsafeKey = isRecognizableNonPublicKey(normalizedKey);
  let reason: string | undefined;
  if (!normalizedUrl || !normalizedKey) {
    reason = 'VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY مفقود';
  } else {
    try {
      const parsed = new URL(normalizedUrl);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
        reason = 'VITE_SUPABASE_URL ليس عنوان HTTP صالحاً للخدمة';
      } else if (PLACEHOLDER_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
        reason = 'VITE_SUPABASE_URL يستخدم نطاقاً وهمياً';
      }
    } catch {
      reason = 'VITE_SUPABASE_URL ليس عنواناً صالحاً';
    }
    if (!reason && unsafeKey) reason = 'مفتاح الخدمة غير صالح للاستخدام العام في المتصفح';
    if (!reason && PLACEHOLDER_KEYS.has(normalizedKey)) reason = 'VITE_SUPABASE_ANON_KEY يستخدم قيمة وهمية';
  }
  return {
    supabaseUrl: reason ? SUPABASE_FALLBACK_URL : normalizedUrl,
    supabaseAnonKey: reason ? SUPABASE_FALLBACK_KEY : normalizedKey,
    isConfigured: !reason,
    ...(reason ? { reason } : {}),
    ...(unsafeKey ? { errorCode: 'unsafe-key' as const } : {}),
  };
}
