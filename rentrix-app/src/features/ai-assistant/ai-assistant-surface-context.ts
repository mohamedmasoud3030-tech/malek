/**
 * Contextual copilot — surface descriptor (Phase A).
 *
 * Derives a lightweight "where is the user right now" descriptor from the
 * current route. It is pure, read-only, and intentionally minimal:
 * route → entity type + id. The assistant service then loads only the
 * scoped, permission-filtered rows it needs — the surface never ships page
 * objects, and the model never receives private implementation details.
 *
 * Routes are matched against the canonical route shapes (see
 * src/app/navigation/route-contract.ts and the route tree). Anything that
 * does not match degrades safely to a section-only (or bare-route) context.
 */

import type { AiAssistantSurfaceContext, AiAssistantSurfaceEntityType } from './types';

const MAX_ID_LENGTH = 128;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const NON_ENTITY_SEGMENTS = new Set(['new', 'edit']);

function sanitizeId(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  if (id.length === 0 || id.length > MAX_ID_LENGTH) return null;
  if (!SAFE_ID_PATTERN.test(id)) return null;
  if (NON_ENTITY_SEGMENTS.has(id.toLowerCase())) return null;
  return id;
}

type SurfacePattern = {
  entityType: Exclude<AiAssistantSurfaceEntityType, null>;
  /** Which path segment (0-based, after filtering empty segments) holds the entity id. */
  idSegment: number;
  /** When set, this segment must equal the given literal for the pattern to match. */
  literalSegments?: Readonly<Record<number, string>>;
};

/**
 * Entity detail shapes, in match order (most specific first). Segment index
 * 0 is the first non-empty path segment (e.g. `properties` in
 * `/properties/:propertyId`).
 */
const ENTITY_PATTERNS: readonly SurfacePattern[] = [
  // /properties/:propertyId/units/:unitId (canonical unit detail route)
  { entityType: 'unit', idSegment: 3, literalSegments: { 2: 'units' } },
  { entityType: 'property', idSegment: 1 }, // /properties/:propertyId (+ /units)
  { entityType: 'contract', idSegment: 1 }, // /contracts/:contractId
  { entityType: 'tenant', idSegment: 1 }, // /tenants/:tenantId
  { entityType: 'owner', idSegment: 1 }, // /owners/:ownerId
  { entityType: 'person', idSegment: 1 }, // /people/:personId
];

const SECTION_BY_ROOT: Readonly<Record<string, string>> = {
  dashboard: 'dashboard',
  properties: 'properties',
  contracts: 'contracts',
  financials: 'financials',
  maintenance: 'maintenance',
  reports: 'reports',
  settings: 'settings',
};

function sectionForRoot(root: string): string | null {
  return SECTION_BY_ROOT[root] ?? null;
}

export function deriveAiAssistantSurfaceContext(
  pathname: string,
): AiAssistantSurfaceContext {
  const route = typeof pathname === 'string' && pathname ? pathname.replace(/\/+$/, '') || '/' : '/';
  const segments = route.split('/').filter(Boolean);

  const base = segments[0] ?? '';
  const section = sectionForRoot(base);

  const candidate = ENTITY_PATTERNS.find((pattern) => {
    const expectedRoot =
      pattern.entityType === 'unit' || pattern.entityType === 'property'
        ? 'properties'
        : pattern.entityType === 'contract'
          ? 'contracts'
          : pattern.entityType === 'tenant'
            ? 'tenants'
            : pattern.entityType === 'owner'
              ? 'owners'
              : 'people';
    if (segments[0] !== expectedRoot || segments.length <= pattern.idSegment) return false;
    if (pattern.literalSegments) {
      for (const [index, literal] of Object.entries(pattern.literalSegments)) {
        if (segments[Number(index)] !== literal) return false;
      }
    }
    return true;
  });

  if (!candidate) {
    return { route, entityType: null, entityId: null, entityLabel: null, section };
  }

  const entityId = sanitizeId(segments[candidate.idSegment]);
  if (!entityId) {
    // Unknown/unsafe id: keep the section but drop the entity reference so
    // the assistant never queries with an id it cannot validate.
    return { route, entityType: null, entityId: null, entityLabel: null, section };
  }

  // /properties/:id/units keeps the property as the active entity (the user
  // is still "inside" the property workspace); only /units/:unitId switches
  // focus to the unit itself.
  const entityType: AiAssistantSurfaceEntityType =
    candidate.entityType === 'unit' ? 'unit' : candidate.entityType;

  return { route, entityType, entityId, entityLabel: null, section };
}

export const EMPTY_AI_SURFACE_CONTEXT: AiAssistantSurfaceContext = {
  route: '/',
  entityType: null,
  entityId: null,
  entityLabel: null,
  section: null,
};
