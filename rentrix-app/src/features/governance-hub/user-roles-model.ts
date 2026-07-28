import type { UserRole } from '@/domain/types';

export const governedUserRoles = ['ADMIN', 'MANAGER', 'USER'] as const satisfies readonly UserRole[];

export function getRoleLabel(role: UserRole | null): string {
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
