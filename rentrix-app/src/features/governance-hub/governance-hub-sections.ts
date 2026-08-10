import { Building2, FolderTree, KeyRound, ListChecks, SearchCheck, Settings2, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

/** Settings owns administration, security, automation, audit and governance. */
export const governanceHubSections = [
  {
    id: 'company',
    label: 'الشركة',
    description: 'هوية الشركة والوثائق والإعدادات التجارية.',
    icon: Building2,
    permission: 'company.settings.manage',
  },
  {
    id: 'users-permissions',
    label: 'المستخدمون والصلاحيات',
    description: 'إدارة المستخدمين للمسؤول ومراجعة الطلبات للمخوّلين فقط.',
    icon: ShieldAlert,
    permission: 'permission_requests.review',
  },
  {
    id: 'cost-centers',
    label: 'مراكز التكلفة',
    description: 'إدارة تصنيفات مراكز التكلفة التشغيلية.',
    icon: FolderTree,
    permission: 'cost_centers.manage',
  },
  {
    id: 'automation',
    label: 'الأتمتة',
    description: 'قواعد الأتمتة والتنبيهات وسجل التشغيل.',
    icon: Settings2,
    permission: 'automation.view',
  },
  {
    id: 'system-settings',
    label: 'إعدادات النظام',
    description: 'حوكمة النظام وإعداداته الإدارية.',
    icon: SlidersHorizontal,
    permission: 'system.view',
  },
  {
    id: 'audit-log',
    label: 'سجل التدقيق',
    description: 'سجل قراءة فقط لأحداث الحوكمة.',
    icon: ListChecks,
    permission: 'audit.view',
  },
  {
    id: 'data-integrity',
    label: 'سلامة البيانات',
    description: 'فحوصات سلامة العلاقات الأساسية.',
    icon: SearchCheck,
    permission: 'integrity.view',
  },
  {
    id: 'security',
    label: 'الأمان',
    description: 'تحديث كلمة مرور الحساب الحالي.',
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
export type GovernanceHubPermission = (typeof governanceHubSections)[number]['permission'];

export function getVisibleGovernanceHubSections(canAccess: (permission: GovernanceHubPermission) => boolean) {
  return governanceHubSections.filter((section) => canAccess(section.permission));
}
