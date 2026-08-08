import { ContactRound, FileText, MessageSquareText, Users } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type RelationshipsHubSectionId =
  | 'contracts'
  | 'people'
  | 'leads'
  | 'communication';

export type RelationshipsHubSection = SectionTabItem<RelationshipsHubSectionId> & Readonly<{
  description: string;
  permission: AppPermission | null;
}>;

/**
 * Contract workspace keeps supporting relationship tools only. Tenants are a
 * first-class entity and live at /tenants instead of a contract tab.
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
    label: 'جهات التعامل',
    icon: Users,
    description: 'دليل الأشخاص وجهات التعامل المساندة للعقود.',
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
