import { Building2, DoorOpen } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type PortfolioHubSectionId = 'properties' | 'units';

export type PortfolioHubSection = SectionTabItem<PortfolioHubSectionId> & Readonly<{
  description: string;
  permission: AppPermission | null;
}>;

/**
 * Property workspace keeps only asset-specific secondary sections.
 * Owners are a first-class entity at /owners; Lands is now a first-class
 * entity at /lands (Phase 2). Legacy ?section=lands redirects to /lands.
 */
export const portfolioHubSections: readonly PortfolioHubSection[] = [
  {
    id: 'properties',
    label: 'العقارات',
    icon: Building2,
    description: 'ملفات العقارات والأصول والمحفظة التشغيلية.',
    permission: null,
  },
  {
    id: 'units',
    label: 'الوحدات',
    icon: DoorOpen,
    description: 'كل الوحدات وحالات الإشغال.',
    permission: null,
  },
] as const;

export type PortfolioHubPermission = Exclude<PortfolioHubSection['permission'], null>;

export function getVisiblePortfolioHubSections(
  canAccess: (permission: PortfolioHubPermission) => boolean,
) {
  return portfolioHubSections.filter(
    (section) => section.permission === null || canAccess(section.permission),
  );
}
