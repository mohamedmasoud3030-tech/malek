import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env } from '@/lib/env';
import { AUTH_STORAGE_KEY } from '@/features/auth/session-storage';

if (!env.isConfigured) {
  console.error('Supabase environment is incomplete. Runtime diagnostics will be shown in UI.');
}

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_STORAGE_KEY,
  },
});
