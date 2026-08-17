import { Building2, DoorOpen, MapPinned, UserRoundCog } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type PortfolioHubSectionId = 'properties' | 'units' | 'lands' | 'owners';

export type PortfolioHubSection = SectionTabItem<PortfolioHubSectionId> & Readonly<{
  description: string;
  permission: AppPermission | null;
}>;

/**
 * Portfolio answers one question: what does the office manage and for whom?
 * Asset registers and ownership context stay in one workspace. Standalone
 * entity routes remain valid deep links, but they are not separate products.
 */
export const portfolioHubSections: readonly PortfolioHubSection[] = [
  {
    id: 'properties',
    label: 'العقارات',
    icon: Building2,
    description: 'العقارات والأصول المدارة وحالتها التشغيلية.',
    permission: null,
  },
  {
    id: 'units',
    label: 'الوحدات',
    icon: DoorOpen,
    description: 'الوحدات وحالات الإشغال والجاهزية.',
    permission: null,
  },
  {
    id: 'lands',
    label: 'الأراضي',
    icon: MapPinned,
    description: 'قطع الأراضي كأصول ضمن المحفظة المدارة.',
    permission: 'lands.view',
  },
  {
    id: 'owners',
    label: 'الملاك',
    icon: UserRoundCog,
    description: 'الملاك وعلاقات الملكية بالأصول المدارة.',
    permission: 'owners.hub.view',
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
