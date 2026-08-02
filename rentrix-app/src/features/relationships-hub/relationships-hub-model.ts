import { canAccess, type AuthorizationContext } from '@/features/auth/permissions';
import {
  relationshipsHubSections,
  type RelationshipsHubSection,
  type RelationshipsHubSectionId,
} from './relationships-hub-sections';

export function canViewRelationshipsSection(
  authorization: AuthorizationContext | null | undefined,
  section: RelationshipsHubSection,
): boolean {
  if (!authorization) return false;
  return section.permission === null ? true : canAccess(authorization, section.permission);
}

export function getVisibleRelationshipsSections(
  authorization: AuthorizationContext | null | undefined,
): readonly RelationshipsHubSection[] {
  return relationshipsHubSections.filter((section) =>
    canViewRelationshipsSection(authorization, section),
  );
}

const sectionIds = new Set<string>(relationshipsHubSections.map((section) => section.id));

export function isRelationshipsHubSectionId(value: unknown): value is RelationshipsHubSectionId {
  return typeof value === 'string' && sectionIds.has(value);
}

export type RelationshipsHubResolution = Readonly<{
  activeSection: RelationshipsHubSectionId | null;
  visibleSections: readonly RelationshipsHubSection[];
  isRequestedSectionForbidden: boolean;
  hasNoVisibleSections: boolean;
}>;

export function resolveRelationshipsHubState({
  requestedSection,
  defaultSection,
  authorization,
}: Readonly<{
  requestedSection: unknown;
  defaultSection: RelationshipsHubSectionId;
  authorization: AuthorizationContext | null | undefined;
}>): RelationshipsHubResolution {
  const visibleSections = getVisibleRelationshipsSections(authorization);
  const visibleIds = new Set(visibleSections.map((section) => section.id));

  if (visibleSections.length === 0) {
    return {
      activeSection: null,
      visibleSections,
      isRequestedSectionForbidden: false,
      hasNoVisibleSections: true,
    };
  }

  if (isRelationshipsHubSectionId(requestedSection) && !visibleIds.has(requestedSection)) {
    return {
      activeSection: null,
      visibleSections,
      isRequestedSectionForbidden: true,
      hasNoVisibleSections: false,
    };
  }

  if (isRelationshipsHubSectionId(requestedSection) && visibleIds.has(requestedSection)) {
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
