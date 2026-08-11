import { useSyncExternalStore } from 'react';
import type { UserRole } from '@/domain/types';

const KEY = 'rentrix_simulated_role';
const VALID_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER']);
let memoryRole: UserRole = 'ADMIN';

export function getSimulatedRole(): UserRole {
  if (typeof window === 'undefined' || !window.localStorage) return memoryRole;
  try {
    const val = localStorage.getItem(KEY);
    if (val && VALID_ROLES.has(val)) return val as UserRole;
    return memoryRole;
  } catch {
    return memoryRole;
  }
}

export function setSimulatedRole(role: UserRole) {
  memoryRole = role;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(KEY, role);
      window.dispatchEvent(new Event('simulated-role-change'));
    } catch {}
  }
}

export function useSimulatedRole(): UserRole {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined') return () => {};
      window.addEventListener('simulated-role-change', cb);
      return () => window.removeEventListener('simulated-role-change', cb);
    },
    getSimulatedRole,
    getSimulatedRole
  );
}
