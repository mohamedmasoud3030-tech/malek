import { Building2, DoorOpen, MapPinned, UserRoundCog } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type PortfolioHubSectionId = 'properties' | 'owners' | 'units' | 'lands';

export type PortfolioHubSection = SectionTabItem<PortfolioHubSectionId> & Readonly<{
  description: string;
  /**
   * Permission required to see this tab. `null` means authenticated-only,
   * matching the pre-hub standalone route guard.
   */
  permission: AppPermission | null;
}>;

/**
 * Single source of truth for the portfolio hub tabs.
 * Permissions mirror route-tree.ts guards exactly — never widen access.
 *
 *   /properties  -> (protected only)
 *   /owners      -> owners.hub.view
 *   /units       -> (protected only)
 *   /lands       -> lands.view
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
    id: 'owners',
    label: 'الملاك',
    icon: UserRoundCog,
    description: 'إدارة ملفات الملاك وعلاقات الملكية.',
    permission: 'owners.hub.view',
  },
  {
    id: 'units',
    label: 'الوحدات',
    icon: DoorOpen,
    description: 'كل الوحدات وحالات الإشغال.',
    permission: null,
  },
  {
    id: 'lands',
    label: 'الأراضي',
    icon: MapPinned,
    description: 'إدارة قطع الأراضي ومتابعة حالتها.',
    permission: 'lands.view',
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
