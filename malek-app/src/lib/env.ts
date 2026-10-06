import { resolvePublicSupabaseConfig } from './supabase-config';

// Build guard and runtime diagnostics share one validity/placeholder policy.
export const env = resolvePublicSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
