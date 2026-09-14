import type { AuthorizationRole as UserRole } from '@/features/auth/permissions';

export const governedUserRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const satisfies readonly UserRole[];
export type OfficePersona = 'OWNER' | 'EMPLOYEE';
export function getOfficePersona(role: UserRole | null): OfficePersona | null {
  if (!role || !governedUserRoles.includes(role)) return null;
  return role === 'ADMIN' ? 'OWNER' : 'EMPLOYEE';
}
export function getRoleLabel(role: UserRole | null): string {
  const persona = getOfficePersona(role);
  if (persona === 'OWNER') return 'صاحب المكتب';
  if (persona === 'EMPLOYEE') return 'موظف';
  return 'غير مهيأ';
}
export function canManageGovernedUser(actorId: string | null | undefined, targetId: string): boolean {
  return Boolean(actorId) && actorId !== targetId;
}
