import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { navGroups, workspaceChildNavItems } from '../app/navigation/app-nav-items';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P2 — contextual documents contract', () => {
  it('keeps the legacy vault route under Services authority, never as a global product', () => {
    const operations = read('./operations-hub/operations-hub.sections.ts');
    const routeTree = read('../app/router/route-tree.ts');
    const globalPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    const servicesChildren = workspaceChildNavItems['/maintenance'];

    expect(globalPaths).not.toContain('/documents-vault');
    // Routine Services children stay reduced to daily work; the vault stays a
    // real Services section reachable in place via its section deep link.
    expect(servicesChildren.some(([to, , , , , search]) => to === '/maintenance' && search?.section === 'documents_vault')).toBe(false);
    // documents_vault remains a real Services section (aggregate authority);
    // the standalone /documents-vault route is retired — internal navigation
    // reaches the vault only through /maintenance?section=documents_vault.
    expect(operations).toContain("id: 'documents_vault'");
    expect(routeTree).not.toContain("path: '/documents-vault'");
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
