import type { UserRole } from '@/domain/types';

export const governedUserRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const satisfies readonly UserRole[];

export function getRoleLabel(role: UserRole | null): string {
  switch (role) {
    case 'ADMIN':
      return 'مسؤول';
    case 'MANAGER':
      return 'مدير';
    case 'ACCOUNTANT':
      return 'محاسب';
    case 'OPERATIONS':
      return 'عمليات';
    case 'USER':
      return 'مستخدم';
    case 'VIEWER':
      return 'مشاهد';
    default:
      return 'غير مهيأ';
  }
}

export function canManageGovernedUser(actorId: string | null | undefined, targetId: string): boolean {
  return Boolean(actorId) && actorId !== targetId;
}
