import type { UserRole } from '@/domain/types';

export const governedUserRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const satisfies readonly UserRole[];

export function getRoleLabel(role: UserRole | null): string {
  switch (role) {
    case 'ADMIN':
      return 'مالك الشركة';
    case 'MANAGER':
      return 'مسؤول المكتب';
    case 'ACCOUNTANT':
      return 'محاسب';
    case 'OPERATIONS':
      return 'التشغيل';
    case 'USER':
      return 'مستخدم محدود';
    case 'VIEWER':
      return 'مشاهدة فقط';
    default:
      return 'غير مهيأ';
  }
}

export function canManageGovernedUser(actorId: string | null | undefined, targetId: string): boolean {
  return Boolean(actorId) && actorId !== targetId;
}
