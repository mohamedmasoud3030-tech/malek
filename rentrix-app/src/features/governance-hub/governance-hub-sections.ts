import { Building2, FolderTree, KeyRound, ListChecks, SearchCheck, Settings2, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

/**
 * Settings keeps advanced/support destinations addressable for guarded deep links,
 * but primary navigation exposes only routine office-administration work.
 */
export const governanceHubSections = [
  {
    id: 'company',
    label: 'الشركة',
    description: 'هوية الشركة والوثائق والإعدادات التجارية.',
    icon: Building2,
    permission: 'company.settings.manage',
    showInPrimaryNavigation: true,
  },
  {
    id: 'users-permissions',
    label: 'المستخدمون والصلاحيات',
    description: 'إدارة المستخدمين للمسؤول ومراجعة الطلبات للمخوّلين فقط.',
    icon: ShieldAlert,
    permission: 'permission_requests.review',
    showInPrimaryNavigation: true,
  },
  {
    id: 'cost-centers',
    label: 'مراكز التكلفة',
    description: 'إدارة تصنيفات مراكز التكلفة التشغيلية.',
    icon: FolderTree,
    permission: 'cost_centers.manage',
    showInPrimaryNavigation: false,
  },
  {
    id: 'automation',
    label: 'الأتمتة',
    description: 'قواعد الأتمتة والتنبيهات وسجل التشغيل.',
    icon: Settings2,
    permission: 'automation.view',
    showInPrimaryNavigation: false,
  },
  {
    id: 'system-settings',
    label: 'إعدادات النظام',
    description: 'حوكمة النظام وإعداداته الإدارية.',
    icon: SlidersHorizontal,
    permission: 'system.view',
    showInPrimaryNavigation: false,
  },
  {
    id: 'audit-log',
    label: 'سجل التدقيق',
    description: 'سجل قراءة فقط لأحداث الحوكمة.',
    icon: ListChecks,
    permission: 'audit.view',
    showInPrimaryNavigation: false,
  },
  {
    id: 'data-integrity',
    label: 'سلامة البيانات',
    description: 'فحوصات سلامة العلاقات الأساسية.',
    icon: SearchCheck,
    permission: 'integrity.view',
    showInPrimaryNavigation: false,
  },
  {
    id: 'security',
    label: 'الأمان',
    description: 'تحديث كلمة مرور الحساب الحالي.',
    icon: KeyRound,
    permission: 'auth.password.change',
    showInPrimaryNavigation: false,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: AppPermission;
  showInPrimaryNavigation: boolean;
}>;

export type GovernanceHubSectionId = (typeof governanceHubSections)[number]['id'];
export type GovernanceHubPermission = (typeof governanceHubSections)[number]['permission'];

/** Permission-accessible sections, including guarded advanced deep-link surfaces. */
export function getAccessibleGovernanceHubSections(canAccess: (permission: GovernanceHubPermission) => boolean) {
  return governanceHubSections.filter((section) => canAccess(section.permission));
}

/** Routine settings tabs shown to operators. Advanced/support pages stay hidden. */
export function getVisibleGovernanceHubSections(canAccess: (permission: GovernanceHubPermission) => boolean) {
  return getAccessibleGovernanceHubSections(canAccess).filter((section) => section.showInPrimaryNavigation);
}