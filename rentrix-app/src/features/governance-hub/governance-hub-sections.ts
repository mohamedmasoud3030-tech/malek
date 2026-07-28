import { Building2, KeyRound, ListChecks, SearchCheck, ShieldAlert } from 'lucide-react';
import type { AppPermission, AuthorizationContext } from '@/features/auth/permissions';
import { canAccess } from '@/features/auth/permissions';

/**
 * Governance hub tab catalogue. Each tab maps 1:1 to a legacy standalone
 * route/page and is gated by the same permission that route already
 * enforces (see route-tree.ts requirePermission calls) — the hub does not
 * introduce or relax any access rule, it only re-presents the same gated
 * surfaces as tabs instead of separate pages.
 */
export const governanceHubSections = [
  {
    id: 'office',
    label: 'إعدادات المكتب',
    description: 'هوية المكتب، الوثائق، مراكز التكلفة، شروط السداد، والمظهر.',
    icon: Building2,
    permission: 'settings.manage',
  },
  {
    id: 'users-roles',
    label: 'المستخدمون والأدوار',
    description: 'حوكمة الوصول ومحاكي الأدوار وروابط النظام الإدارية.',
    icon: ShieldAlert,
    permission: 'system.view',
  },
  {
    id: 'audit-log',
    label: 'سجل التدقيق',
    description: 'عرض قراءة فقط لأحداث الحوكمة المسجلة في النظام.',
    icon: ListChecks,
    permission: 'audit.view',
  },
  {
    id: 'data-integrity',
    label: 'سلامة البيانات',
    description: 'فحوصات تطابق وسلامة العلاقات الأساسية في المخطط.',
    icon: SearchCheck,
    permission: 'integrity.view',
  },
  {
    id: 'security',
    label: 'كلمة المرور والأمان',
    description: 'تحديث كلمة مرور حسابك الحالي بأمان.',
    icon: KeyRound,
    permission: 'auth.password.change',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: AppPermission;
}>;

export type GovernanceHubSectionId = (typeof governanceHubSections)[number]['id'];

/** Returns only the tabs the current authorization context is permitted to open. */
export function getVisibleGovernanceHubSections(
  authorization: AuthorizationContext | null | undefined,
) {
  return governanceHubSections.filter((section) => canAccess(authorization, section.permission));
}
