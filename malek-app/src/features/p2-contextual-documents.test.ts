import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { navGroups, workspaceChildNavItems } from '../app/navigation/app-nav-items';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P2 — contextual documents contract', () => {
  it('keeps the vault under Services authority as a standalone route, never as a global product', () => {
    const routeTree = read('../app/router/route-tree.ts');
    const globalPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    const servicesChildren = workspaceChildNavItems['/maintenance'];

    // The vault is disclosed as a Services child — the owning workspace,
    // never a competing global product.
    expect(globalPaths).not.toContain('/documents-vault');
    expect(servicesChildren.some(([to]) => to === '/documents-vault')).toBe(true);

    // Navigation architecture consolidation: the vault owns exactly one
    // standalone canonical route, and the retired hub section model is gone.
    expect(routeTree).toContain("path: '/documents-vault'");
    expect(routeTree).toContain("@/features/documents-vault/components/documents-vault-workspace");
    expect(routeTree).not.toContain('operations-hub');

    // The legacy hub deep link hard redirects straight to the canonical route.
    expect(routeTree).toContain("documents_vault: '/documents-vault'");
  });

  it('uses one shared foundation for contract, property, owner, unit, and maintenance contexts', () => {
    const foundation = read('../components/documents/contextual-documents-panel.tsx');
    expect(foundation).toContain('ContextualDocumentsPanel');
    for (const path of [
      '../features/contracts/contractDocumentsShell.tsx',
      '../features/properties/components/property-workspace-tabs.tsx',
      '../features/owners/components/owner-dossier-body.tsx',
      '../features/properties/units/property-unit-detail-page.tsx',
      '../features/maintenance/components/maintenance-detail-resolve-overlays.tsx',
    ]) {
      expect(read(path), path).toContain('ContextualDocuments');
    }
    expect(foundation).toContain('onUpload');
    expect(foundation).toContain('onReplace');
    expect(foundation).toContain('onArchive');
    expect(foundation).toContain('EntityPreviewDialog');
  });
});
