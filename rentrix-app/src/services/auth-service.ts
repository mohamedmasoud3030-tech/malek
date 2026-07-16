import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // Invalid or expired token - return null to trigger redirect to login without loop
      console.warn('getCurrentSession error, treating as no session:', error.message);
      return null;
    }
    return data.session;
  } catch (err) {
    console.warn('getCurrentSession exception, treating as no session:', err);
    return null;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
