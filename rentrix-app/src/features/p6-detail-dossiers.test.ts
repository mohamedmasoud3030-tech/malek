import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6 — route-native dossier architecture guard', () => {
  it('keeps one shared preview dialog foundation across priority entities', () => {
    const files = [
      './owners/components/OwnerPreviewDialog.tsx',
      './tenants/components/TenantPreviewDialog.tsx',
      './people/components/PersonDossier.tsx',
      './lands/components/LandDossier.tsx',
      './units/components/UnitPreviewDialog.tsx',
    ];
    for (const file of files) expect(read(file), file).toContain('EntityPreviewDialog');
  });

  it('provides direct-page fallbacks and contextual documents without local-list-only previews', () => {
    expect(read('./people/components/PersonDossier.tsx')).toContain('PersonDetailPage');
    expect(read('./tenants/components/TenantPreviewDialog.tsx')).toContain('TenantDetailPage');
    expect(read('./lands/components/LandDossier.tsx')).toContain('LandDetailPage');
    expect(read('./people/people-list-page.tsx')).toContain("'/people/$personId'");
    expect(read('./tenants/TenantsPage.tsx')).toContain("'/tenants/$tenantId'");
    expect(read('./lands/components/lands-view.tsx')).toContain("'/lands/$landId'");
    expect(read('../components/documents/contextual-documents-section.tsx')).toContain('ContextualDocumentsPanel');
  });
});
