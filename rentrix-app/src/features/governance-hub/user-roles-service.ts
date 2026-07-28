import type { UserRole } from '@/domain/types';
import { supabase } from '@/lib/supabase';

export type GovernedUser = Readonly<{
  id: string;
  email: string;
  name: string;
  fullName: string | null;
  role: UserRole | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | null;
  isActive: boolean;
  lastLogin: string | null;
}>;

type UserRow = {
  id: string;
  email: string;
  name: string;
  full_name: string | null;
  role: UserRole | null;
  status: GovernedUser['status'];
  is_active: boolean;
  last_login: string | null;
};

export async function fetchGovernedUsers(): Promise<GovernedUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, full_name, role, status, is_active, last_login')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as UserRow[]).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    fullName: user.full_name,
    role: user.role,
    status: user.status,
    isActive: user.is_active,
    lastLogin: user.last_login,
  }));
}

export async function updateGovernedUserAccess(input: Readonly<{
  id: string;
  role: UserRole;
  isActive: boolean;
}>): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      role: input.role,
      is_active: input.isActive,
      status: input.isActive ? 'ACTIVE' : 'INACTIVE',
    })
    .eq('id', input.id);

  if (error) throw error;
}
