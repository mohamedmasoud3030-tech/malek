import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P2 — contextual documents contract', () => {
  it('keeps the legacy vault route but removes it from operational surfaces', () => {
    const nav = read('../app/navigation/app-nav-items.ts');
    const operations = read('./operations-hub/operations-hub.sections.ts');
    const routeTree = read('../app/router/route-tree.ts');
    expect(nav).not.toContain("'/documents-vault'");
    expect(operations).not.toContain('documents_vault');
    expect(routeTree).toContain("path: '/documents-vault'");
    expect(routeTree).toContain('_protected.documents-vault');
  });

  it('uses one shared foundation for contract, property, owner, unit, and maintenance contexts', () => {
    const foundation = read('../components/documents/contextual-documents-panel.tsx');
    expect(foundation).toContain('ContextualDocumentsPanel');
    for (const path of [
      '../features/contracts/contractDocumentsShell.tsx',
      '../features/properties/components/property-workspace-tabs.tsx',
      '../features/owners/components/OwnerPreviewDialog.tsx',
      '../features/units/components/UnitPreviewDialog.tsx',
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
