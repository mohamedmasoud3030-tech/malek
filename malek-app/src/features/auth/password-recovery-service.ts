import type { SupabaseClient } from '@supabase/supabase-js';

export async function requestPasswordRecovery(
  client: Pick<SupabaseClient, 'auth'>,
  email: string,
  redirectTo: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, error };
  return { ok: true };
}

export function buildPasswordRecoveryRedirect(origin: string): string {
  return new URL('/reset-password', origin).toString();
}
