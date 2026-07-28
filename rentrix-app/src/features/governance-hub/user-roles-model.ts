import { authorizationRoles, type AuthorizationRole } from '@/features/auth/permissions';

export const governedUserRoles = authorizationRoles;

export function getRoleLabel(role: AuthorizationRole | null): string {
  switch (role) {
    case 'ADMIN':
      return 'مسؤول';
    case 'MANAGER':
      return 'مدير';
    case 'USER':
      return 'مستخدم';
    default:
      return 'غير مهيأ';
  }
}

export function canManageGovernedUser(actorId: string | null | undefined, targetId: string): boolean {
  return Boolean(actorId) && actorId !== targetId;
}
