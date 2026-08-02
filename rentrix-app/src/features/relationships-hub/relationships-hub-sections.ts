import { ContactRound, FileText, MessageSquareText, UserCheck, Users } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type RelationshipsHubSectionId =
  | 'contracts'
  | 'people'
  | 'tenants'
  | 'leads'
  | 'communication';

export type RelationshipsHubSection = SectionTabItem<RelationshipsHubSectionId> & Readonly<{
  description: string;
  /**
   * Permission required to see this tab. `null` means authenticated-only,
   * matching the pre-hub standalone route guard.
   */
  permission: AppPermission | null;
}>;

/**
 * Single source of truth for the relationships hub tabs.
 * Permissions mirror route-tree.ts guards exactly — never widen access.
 *
 *   /contracts     -> (protected only)
 *   /people        -> (protected only)
 *   /tenants       -> (protected only)
 *   /leads         -> leads.view
 *   /communication -> communication.view
 */
export const relationshipsHubSections: readonly RelationshipsHubSection[] = [
  {
    id: 'contracts',
    label: 'العقود',
    icon: FileText,
    description: 'العقود والتجديدات ودورة حياة العقد.',
    permission: null,
  },
  {
    id: 'people',
    label: 'الأشخاص',
    icon: Users,
    description: 'دليل جهات التعامل الموحد.',
    permission: null,
  },
  {
    id: 'tenants',
    label: 'المستأجرون',
    icon: UserCheck,
    description: 'بيانات المستأجرين وملفاتهم.',
    permission: null,
  },
  {
    id: 'leads',
    label: 'العملاء المحتملون',
    icon: ContactRound,
    description: 'مصادر العملاء المحتملين والتحويلات.',
    permission: 'leads.view',
  },
  {
    id: 'communication',
    label: 'التواصل',
    icon: MessageSquareText,
    description: 'سجل التواصل والمتابعات التشغيلية.',
    permission: 'communication.view',
  },
] as const;

export type RelationshipsHubPermission = Exclude<RelationshipsHubSection['permission'], null>;

export function getVisibleRelationshipsHubSections(
  canAccess: (permission: RelationshipsHubPermission) => boolean,
) {
  return relationshipsHubSections.filter(
    (section) => section.permission === null || canAccess(section.permission),
  );
}
