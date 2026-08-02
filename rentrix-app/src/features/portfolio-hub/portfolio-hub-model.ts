import { canAccess, type AuthorizationContext } from '@/features/auth/permissions';
import {
  portfolioHubSections,
  type PortfolioHubSection,
  type PortfolioHubSectionId,
} from './portfolio-hub-sections';

export function canViewPortfolioSection(
  authorization: AuthorizationContext | null | undefined,
  section: PortfolioHubSection,
): boolean {
  if (!authorization) return false;
  return section.permission === null ? true : canAccess(authorization, section.permission);
}

export function getVisiblePortfolioSections(
  authorization: AuthorizationContext | null | undefined,
): readonly PortfolioHubSection[] {
  return portfolioHubSections.filter((section) => canViewPortfolioSection(authorization, section));
}

const sectionIds = new Set<string>(portfolioHubSections.map((section) => section.id));

export function isPortfolioHubSectionId(value: unknown): value is PortfolioHubSectionId {
  return typeof value === 'string' && sectionIds.has(value);
}

export type PortfolioHubResolution = Readonly<{
  activeSection: PortfolioHubSectionId | null;
  visibleSections: readonly PortfolioHubSection[];
  isRequestedSectionForbidden: boolean;
  hasNoVisibleSections: boolean;
}>;

export function resolvePortfolioHubState({
  requestedSection,
  defaultSection,
  authorization,
}: Readonly<{
  requestedSection: unknown;
  defaultSection: PortfolioHubSectionId;
  authorization: AuthorizationContext | null | undefined;
}>): PortfolioHubResolution {
  const visibleSections = getVisiblePortfolioSections(authorization);
  const visibleIds = new Set(visibleSections.map((section) => section.id));

  if (visibleSections.length === 0) {
    return {
      activeSection: null,
      visibleSections,
      isRequestedSectionForbidden: false,
      hasNoVisibleSections: true,
    };
  }

  if (isPortfolioHubSectionId(requestedSection) && !visibleIds.has(requestedSection)) {
    return {
      activeSection: null,
      visibleSections,
      isRequestedSectionForbidden: true,
      hasNoVisibleSections: false,
    };
  }

  if (isPortfolioHubSectionId(requestedSection) && visibleIds.has(requestedSection)) {
    return {
      activeSection: requestedSection,
      visibleSections,
      isRequestedSectionForbidden: false,
      hasNoVisibleSections: false,
    };
  }

  const activeSection = visibleIds.has(defaultSection) ? defaultSection : visibleSections[0].id;
  return {
    activeSection,
    visibleSections,
    isRequestedSectionForbidden: false,
    hasNoVisibleSections: false,
  };
}
