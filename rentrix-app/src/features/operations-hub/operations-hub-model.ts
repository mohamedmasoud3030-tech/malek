import { canAccess, type AuthorizationContext } from '@/features/auth/permissions';
import {
  operationsHubSections,
  type OperationsHubSection,
  type OperationsHubSectionId,
} from './operations-hub.sections';

/**
 * Pure model behind the operations workspace.
 *
 * Kept free of React so permission filtering and URL resolution can be unit
 * tested directly, and so every entry route runs the exact same rules.
 */

export function canViewOperationsSection(
  authorization: AuthorizationContext | null | undefined,
  section: OperationsHubSection,
): boolean {
  if (!authorization) return false;
  return section.permission === null ? true : canAccess(authorization, section.permission);
}

export function getVisibleOperationsSections(
  authorization: AuthorizationContext | null | undefined,
): readonly OperationsHubSection[] {
  return operationsHubSections.filter((section) => canViewOperationsSection(authorization, section));
}

const sectionIds = new Set<string>(operationsHubSections.map((section) => section.id));

export function isOperationsHubSectionId(value: unknown): value is OperationsHubSectionId {
  return typeof value === 'string' && sectionIds.has(value);
}

export type OperationsHubResolution = Readonly<{
  activeSection: OperationsHubSectionId | null;
  visibleSections: readonly OperationsHubSection[];
  isRequestedSectionForbidden: boolean;
  hasNoVisibleSections: boolean;
}>;

/**
 * Resolves which section should be active from (url, default, permissions).
 *
 * Precedence:
 *   1. a valid, permitted `?section=` value  (deep link wins)
 *   2. the entry page's default section, when permitted
 *   3. the first permitted section           (never a forbidden fallback)
 */
export function resolveOperationsHubState({
  requestedSection,
  defaultSection,
  authorization,
}: Readonly<{
  requestedSection: unknown;
  defaultSection: OperationsHubSectionId;
  authorization: AuthorizationContext | null | undefined;
}>): OperationsHubResolution {
  const visibleSections = getVisibleOperationsSections(authorization);
  const visibleIds = new Set(visibleSections.map((section) => section.id));

  if (visibleSections.length === 0) {
    return {
      activeSection: null,
      visibleSections,
      isRequestedSectionForbidden: false,
      hasNoVisibleSections: true,
    };
  }

  if (isOperationsHubSectionId(requestedSection) && !visibleIds.has(requestedSection)) {
    return {
      activeSection: null,
      visibleSections,
      isRequestedSectionForbidden: true,
      hasNoVisibleSections: false,
    };
  }

  if (isOperationsHubSectionId(requestedSection) && visibleIds.has(requestedSection)) {
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
