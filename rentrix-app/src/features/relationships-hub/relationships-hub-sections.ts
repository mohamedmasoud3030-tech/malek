import { ContactRound, FileText, MessageSquareText } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type RelationshipsHubSectionId =
  | 'contracts'
  | 'leads'
  | 'communication';

export type RelationshipsHubSection = SectionTabItem<RelationshipsHubSectionId> & Readonly<{
  description: string;
  permission: AppPermission | null;
}>;

/**
 * Contract workspace keeps supporting relationship tools only.
 * Tenants are a first-class entity at /tenants; People is now a first-class
 * entity at /people (Phase 2). Legacy ?section=people redirects to /people.
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
