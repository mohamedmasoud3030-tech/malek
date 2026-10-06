import { describe, expect, it } from 'vitest';
import { findRouteBlock, registeredRoutePaths, topLevelRoutePaths } from './route-tree-paths';

/**
 * Structural tests for the route-tree path resolver.
 *
 * Guards the resolver itself so route assertions never fall back to naive
 * substring matching: nested child paths (`/properties/$propertyId/units`
 * declares `path: '/units'`) and index children (`path: '/'`) must resolve
 * through the parent chain instead of being mistaken for top-level routes.
 */
describe('route-tree-paths structural resolver', () => {
  it('resolves index and public routes through the root parent chain', () => {
    const paths = registeredRoutePaths();
    expect(paths).toContain('/');
    expect(paths).toContain('/login');
    expect(paths).toContain('/privacy');
  });

  it('resolves nested child paths to their full path, not their segment', () => {
    const paths = registeredRoutePaths();
    // The property detail route declares a child with path '/units'; the FULL
    // registered path is the nested one while a top-level '/units' is retired.
    expect(paths).toContain('/properties/$propertyId/units');
    expect(paths).toContain('/properties/$propertyId/units/$unitId');
    expect(topLevelRoutePaths()).not.toContain('/units');
  });

  it('resolves index children of a detail route to the parent full path', () => {
    const paths = registeredRoutePaths();
    // propertyIndexRoute declares path '/'; it must not collapse into '/'.
    expect(paths).toContain('/properties/$propertyId');
  });

  it('never reports a top-level path twice', () => {
    const paths = topLevelRoutePaths();
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('returns the full createRoute block for an exact path', () => {
    const receiptsBlock = findRouteBlock('/receipts');
    expect(receiptsBlock).toContain("path: '/receipts'");
    expect(receiptsBlock).toContain('ReceiptsWorkspace');
  });
});
