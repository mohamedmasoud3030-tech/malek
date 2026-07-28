import { canAccess, type AuthorizationContext } from '@/features/auth/permissions';
import { financeHubSections, isFinanceHubSectionId, type FinanceHubSection, type FinanceHubSectionId } from './finance-hub-sections';

/**
 * Pure model behind the finance workspace.
 *
 * Kept free of React so permission filtering and URL resolution can be unit
 * tested directly, and so both the standalone routes and the embedded hub run
 * the exact same rules.
 */

/**
 * Every tab validates its own permission independently — route-level guards are
 * treated as defence in depth, never as the only check. A section with a `null`
 * permission keeps the authenticated-only contract its standalone route had
 * before the merge.
 */
export function canViewFinanceSection(
  authorization: AuthorizationContext | null | undefined,
  section: FinanceHubSection,
): boolean {
  if (!authorization) return false;
  return section.permission === null ? true : canAccess(authorization, section.permission);
}

/** The subset of tabs the current user may actually see. */
export function getVisibleFinanceSections(
  authorization: AuthorizationContext | null | undefined,
): readonly FinanceHubSection[] {
  return financeHubSections.filter((section) => canViewFinanceSection(authorization, section));
}

export type FinanceHubResolution = Readonly<{
  /** The section to render, or null when the user may see nothing at all. */
  activeSection: FinanceHubSectionId | null;
  /** Tabs to render in the tab bar (already permission filtered). */
  visibleSections: readonly FinanceHubSection[];
  /**
   * True when the URL requested a specific section that the user may not see.
   * Surfaced as an explicit access-denied instead of a silent redirect, so a
   * shared deep link never looks like a broken page.
   */
  isRequestedSectionForbidden: boolean;
  /** True when the user may not see any finance section at all. */
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
export function resolveFinanceHubState({
  requestedSection,
  defaultSection,
  authorization,
}: Readonly<{
  requestedSection: unknown;
  defaultSection: FinanceHubSectionId;
  authorization: AuthorizationContext | null | undefined;
}>): FinanceHubResolution {
  const visibleSections = getVisibleFinanceSections(authorization);
  const visibleIds = new Set(visibleSections.map((section) => section.id));

  if (visibleSections.length === 0) {
    return { activeSection: null, visibleSections, isRequestedSectionForbidden: false, hasNoVisibleSections: true };
  }

  // A deep link to a real section the user cannot see is an authorization
  // failure, not a routing failure — say so instead of quietly showing
  // different data than the URL promised.
  if (isFinanceHubSectionId(requestedSection) && !visibleIds.has(requestedSection)) {
    return { activeSection: null, visibleSections, isRequestedSectionForbidden: true, hasNoVisibleSections: false };
  }

  if (isFinanceHubSectionId(requestedSection) && visibleIds.has(requestedSection)) {
    return { activeSection: requestedSection, visibleSections, isRequestedSectionForbidden: false, hasNoVisibleSections: false };
  }

  // Unknown/absent `?section=` falls back to the entry page default. An
  // unreadable default degrades to the first permitted tab rather than
  // rendering a forbidden section.
  const activeSection = visibleIds.has(defaultSection) ? defaultSection : visibleSections[0].id;
  return { activeSection, visibleSections, isRequestedSectionForbidden: false, hasNoVisibleSections: false };
}
