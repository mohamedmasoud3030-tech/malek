import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6 — contextual dossier contract', () => {
  it('keeps the shared preview architecture across priority entities', () => {
    const files = [
      './owners/components/OwnerPreviewDialog.tsx',
      './tenants/components/TenantPreviewDialog.tsx',
      './people/people-list-page.tsx',
      './contracts/components/ContractPreviewDialog.tsx',
      './properties/components/PropertyPreviewDialog.tsx',
      './units/components/UnitPreviewDialog.tsx',
    ];
    for (const file of files) expect(read(file), file).toContain('EntityPreviewDialog');
    expect(read('../components/documents/contextual-documents-section.tsx')).toContain('ContextualDocumentsPanel');
  });

  it('keeps dossier hierarchy contextual and avoids new detail pages', () => {
    const owner = read('./owners/components/OwnerPreviewDialog.tsx');
    const tenant = read('./tenants/components/TenantPreviewDialog.tsx');
    const contract = read('./contracts/components/ContractPreviewDialog.tsx');
    expect(owner).toContain('ContextualDocuments');
    expect(tenant).toContain('ContextualDocuments');
    expect(contract).toContain('ContractDocumentsShell');
    expect(tenant).toContain('عقد نشط');
    expect(tenant).toContain('متأخرات');
    expect(contract).toContain('ContractFinancialTimelineSection');
  });
});
