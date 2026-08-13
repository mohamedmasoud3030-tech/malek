import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTE_CONTRACT, REDIRECT_ROUTES } from './route-contract';
import { getNavRoot } from './route-nav-map';
import { isOperationsHubSectionId } from '@/features/operations-hub/operations-hub-model';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

/** Isolates the /documents-vault route definition block from route-tree.ts. */
function documentsVaultRouteBlock(): string {
  const token = "path: '/documents-vault'";
  const pathIndex = routeTreeSource.indexOf(token);
  const routeStart = routeTreeSource.lastIndexOf('createRoute({', pathIndex);
  const routeEnd = routeTreeSource.indexOf('});', pathIndex);
  return routeTreeSource.slice(routeStart, routeEnd + 3);
}

describe('WP-06A — documents vault route consolidation', () => {
  it('redirects /documents-vault to the single maintenance authority', () => {
    const block = documentsVaultRouteBlock();
    expect(block).toContain("to: '/maintenance'");
    expect(block).toContain("section: 'documents_vault'");
    expect(block).toContain('redirect');
    expect(block).toContain('beforeLoad');
  });

  it('preserves incoming search while pinning the section (no standalone page)', () => {
    const block = documentsVaultRouteBlock();
    expect(block).toContain('...previous');
    expect(block).not.toContain('_protected.documents-vault');
    expect(block).not.toContain('lazyRouteComponent');
  });

  it('cannot loop: /maintenance never redirects back to /documents-vault', () => {
    const maintenanceToken = "path: '/maintenance'";
    const idx = routeTreeSource.indexOf(maintenanceToken);
    const block = routeTreeSource.slice(idx, idx + 400);
    expect(block).not.toContain("to: '/documents-vault'");
  });

  it('route contract, nav map, and redirect list agree on one authority', () => {
    const contract = ROUTE_CONTRACT.find((entry) => entry.canonical === '/documents-vault');
    expect(contract).toBeDefined();
    expect(contract!.sidebarRoot).toBe('/maintenance');
    expect(contract!.viewBinding).toEqual({ param: 'section', section: 'documents_vault' });
    expect(REDIRECT_ROUTES).toContain('/documents-vault');
    expect(getNavRoot('/documents-vault')).toBe('/maintenance');
  });

  it('redirects to a real Operations Hub section (no silent fallback to maintenance)', () => {
    // The redirect target must be a registered section, otherwise the hub
    // silently falls back to the default section while the URL looks correct.
    expect(isOperationsHubSectionId('documents_vault')).toBe(true);
  });
});
