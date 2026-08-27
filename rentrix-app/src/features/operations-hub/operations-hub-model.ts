import { canAccess, type AuthorizationContext } from '@/features/auth/permissions';
import {
  operationsHubSections,
  type OperationsHubSection,
  type OperationsHubSectionId,
} from './operations-hub.sections';

export function canViewOperationsSection(
  authorization: AuthorizationContext | null | undefined,
  section: OperationsHubSection,
): boolean {
  if (!authorization) return false;
  return section.permission === null ? true : canAccess(authorization, section.permission);
}

export function getAccessibleOperationsSections(
  authorization: AuthorizationContext | null | undefined,
): readonly OperationsHubSection[] {
  return operationsHubSections.filter((section) => canViewOperationsSection(authorization, section));
}

export function getVisibleOperationsSections(
  authorization: AuthorizationContext | null | undefined,
): readonly OperationsHubSection[] {
  return getAccessibleOperationsSections(authorization).filter((section) => section.showInPrimaryNavigation);
}

const sectionIds = new Set<string>(operationsHubSections.map((section) => section.id));

export function isOperationsHubSectionId(value: unknown): value is OperationsHubSectionId {
  return typeof value === 'string' && sectionIds.has(value);
}

export type OperationsHubResolution = Readonly<{
  activeSection: OperationsHubSectionId | null;
  accessibleSections: readonly OperationsHubSection[];
  visibleSections: readonly OperationsHubSection[];
  isRequestedSectionForbidden: boolean;
  hasNoAccessibleSections: boolean;
}>;

/** Resolve a permitted deep link while exposing only routine sections as tabs. */
export function resolveOperationsHubState({
  requestedSection,
  defaultSection,
  authorization,
}: Readonly<{
  requestedSection: unknown;
  defaultSection: OperationsHubSectionId;
  authorization: AuthorizationContext | null | undefined;
}>): OperationsHubResolution {
  const accessibleSections = getAccessibleOperationsSections(authorization);
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

  if (isOperationsHubSectionId(requestedSection) && !accessibleIds.has(requestedSection)) {
    return {
      activeSection: null,
      accessibleSections,
      visibleSections,
      isRequestedSectionForbidden: true,
      hasNoAccessibleSections: false,
    };
  }

  if (isOperationsHubSectionId(requestedSection) && accessibleIds.has(requestedSection)) {
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
