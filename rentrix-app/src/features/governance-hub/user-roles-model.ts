import type { UserRole } from '@/domain/types';

/**
 * The six-role engine remains an internal compatibility/security primitive.
 * Routine office UX intentionally exposes only two personas.
 */
export const governedUserRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const satisfies readonly UserRole[];

export type OfficePersona = 'OWNER' | 'EMPLOYEE';

export function getOfficePersona(role: UserRole | null): OfficePersona | null {
  if (!role) return null;
  return role === 'ADMIN' ? 'OWNER' : 'EMPLOYEE';
}

/**
 * Business-facing label only. Never leak the internal six-role taxonomy into
 * routine employee management screens.
 */
export function getRoleLabel(role: UserRole | null): string {
  const persona = getOfficePersona(role);
  if (persona === 'OWNER') return 'صاحب المكتب';
  if (persona === 'EMPLOYEE') return 'موظف';
  return 'غير مهيأ';
}

export function canManageGovernedUser(actorId: string | null | undefined, targetId: string): boolean {
  return Boolean(actorId) && actorId !== targetId;
}
