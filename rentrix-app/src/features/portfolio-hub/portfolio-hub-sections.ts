import { Building2, DoorOpen, MapPinned, UserRoundCog } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type PortfolioHubSectionId = 'properties' | 'units' | 'lands' | 'owners';

export type PortfolioHubSection = SectionTabItem<PortfolioHubSectionId> & Readonly<{
  description: string;
  permission: AppPermission | null;
  showInPrimaryNavigation: boolean;
}>;

/**
 * Portfolio keeps daily asset work on properties, units and owners. Lands remain
 * a supported specialist register but do not occupy routine navigation space.
 */
export const portfolioHubSections: readonly PortfolioHubSection[] = [
  {
    id: 'properties',
    label: 'العقارات',
    icon: Building2,
    description: 'العقارات والأصول المدارة وحالتها التشغيلية.',
    permission: null,
    showInPrimaryNavigation: true,
  },
  {
    id: 'units',
    label: 'الوحدات',
    icon: DoorOpen,
    description: 'الوحدات وحالات الإشغال والجاهزية.',
    permission: null,
    showInPrimaryNavigation: true,
  },
  {
    id: 'lands',
    label: 'الأراضي',
    icon: MapPinned,
    description: 'قطع الأراضي كأصول ضمن المحفظة المدارة.',
    permission: 'lands.view',
    showInPrimaryNavigation: false,
  },
  {
    id: 'owners',
    label: 'الملاك',
    icon: UserRoundCog,
    description: 'الملاك وعلاقات الملكية بالأصول المدارة.',
    permission: 'owners.hub.view',
    showInPrimaryNavigation: true,
  },
] as const;

export type PortfolioHubPermission = Exclude<PortfolioHubSection['permission'], null>;

export function getAccessiblePortfolioHubSections(
  canAccess: (permission: PortfolioHubPermission) => boolean,
) {
  return portfolioHubSections.filter(
    (section) => section.permission === null || canAccess(section.permission),
  );
}

export function getVisiblePortfolioHubSections(
  canAccess: (permission: PortfolioHubPermission) => boolean,
) {
  return getAccessiblePortfolioHubSections(canAccess).filter((section) => section.showInPrimaryNavigation);
}
