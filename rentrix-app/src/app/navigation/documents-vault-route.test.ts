import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

describe('Navigation consolidation — documents vault standalone route', () => {
  it('registers /documents-vault as a canonical standalone destination', () => {
    expect(routeTreeSource).toContain("path: '/documents-vault'");
    expect(routeTreeSource).toContain("@/features/documents-vault/components/documents-vault-workspace");
    expect(routeTreeSource).not.toContain('operations-hub');
  });

  it('/maintenance legacy documents_vault deep links redirect directly to /documents-vault', () => {
    const maintenanceToken = "path: '/maintenance'";
    const idx = routeTreeSource.indexOf(maintenanceToken);
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = routeTreeSource.slice(idx, idx + 900);
    expect(block).toContain("documents_vault: '/documents-vault'");
    expect(block).toContain("to: target");
  });

  it('does not retain an Operations Hub section model or retired route authority', () => {
    expect(routeTreeSource).not.toContain('isOperationsHubSectionId');
    expect(routeTreeSource).not.toContain('operations-hub-model');
    expect(routeTreeSource).not.toContain('OperationsHub');
  });
});
