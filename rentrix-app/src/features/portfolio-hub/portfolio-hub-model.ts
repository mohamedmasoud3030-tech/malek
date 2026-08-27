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

export function getAccessiblePortfolioSections(
  authorization: AuthorizationContext | null | undefined,
): readonly PortfolioHubSection[] {
  return portfolioHubSections.filter((section) => canViewPortfolioSection(authorization, section));
}

export function getVisiblePortfolioSections(
  authorization: AuthorizationContext | null | undefined,
): readonly PortfolioHubSection[] {
  return getAccessiblePortfolioSections(authorization).filter((section) => section.showInPrimaryNavigation);
}

const sectionIds = new Set<string>(portfolioHubSections.map((section) => section.id));

export function isPortfolioHubSectionId(value: unknown): value is PortfolioHubSectionId {
  return typeof value === 'string' && sectionIds.has(value);
}

export type PortfolioHubResolution = Readonly<{
  activeSection: PortfolioHubSectionId | null;
  accessibleSections: readonly PortfolioHubSection[];
  visibleSections: readonly PortfolioHubSection[];
  isRequestedSectionForbidden: boolean;
  hasNoAccessibleSections: boolean;
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
  const accessibleSections = getAccessiblePortfolioSections(authorization);
  const visibleSections = accessibleSections.filter((section) => section.showInPrimaryNavigation);
  const accessibleIds = new Set(accessibleSections.map((section) => section.id));

  if (accessibleSections.length === 0) {
    return {
      activeSection: null,
      accessibleSections,
      visibleSections,
      isRequestedSectionForbidden: false,
      hasNoAccessibleSections: true,
    };
  }

  if (isPortfolioHubSectionId(requestedSection) && !accessibleIds.has(requestedSection)) {
    return {
      activeSection: null,
      accessibleSections,
      visibleSections,
      isRequestedSectionForbidden: true,
      hasNoAccessibleSections: false,
    };
  }

  if (isPortfolioHubSectionId(requestedSection) && accessibleIds.has(requestedSection)) {
    return {
      activeSection: requestedSection,
      accessibleSections,
      visibleSections,
      isRequestedSectionForbidden: false,
      hasNoAccessibleSections: false,
    };
  }

  const visibleIds = new Set(visibleSections.map((section) => section.id));
  const activeSection = visibleIds.has(defaultSection)
    ? defaultSection
    : visibleSections[0]?.id ?? accessibleSections[0].id;

  return {
    activeSection,
    accessibleSections,
    visibleSections,
    isRequestedSectionForbidden: false,
    hasNoAccessibleSections: false,
  };
}
