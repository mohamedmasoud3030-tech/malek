import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6c — people and tenant dossier consistency (closeout)', () => {
  it('renders money with the shared company formatter, never raw toFixed decimals', () => {
    const person = read('./people/components/PersonDossier.tsx');
    const tenant = read('./tenants/components/TenantPreviewDialog.tsx');
    for (const source of [person, tenant]) {
      expect(source).toContain('formatDefaultCompanyMoney');
      expect(source).not.toContain('.toFixed(');
    }
  });

  it('keeps readable business references and no raw ids in both dossiers', () => {
    const person = read('./people/components/PersonDossier.tsx');
    const tenant = read('./tenants/components/TenantPreviewDialog.tsx');
    for (const source of [person, tenant]) {
      expect(source).toContain('businessReferenceOrLabel');
      expect(source).toContain('contract.properties?.title');
    }
  });

  it('aligns identity counts: active and total contracts shown for both person and tenant', () => {
    expect(read('./people/components/PersonDossier.tsx')).toContain('العقود النشطة');
    expect(read('./people/components/PersonDossier.tsx')).toContain('إجمالي العقود');
    expect(read('./tenants/components/TenantPreviewDialog.tsx')).toContain('العقود النشطة');
    expect(read('./tenants/components/TenantPreviewDialog.tsx')).toContain('إجمالي العقود');
  });

  it('keeps per-invoice open actions consistent across person and tenant', () => {
    const person = read('./people/components/PersonDossier.tsx');
    const tenant = read('./tenants/components/TenantPreviewDialog.tsx');
    expect(person).toContain('فتح الفاتورة');
    expect(tenant).toContain('فتح الفاتورة');
  });

  it('keeps one shared dossier body per preview and detail surface', () => {
    const person = read('./people/components/PersonDossier.tsx');
    const tenant = read('./tenants/components/TenantPreviewDialog.tsx');
    expect(person).toContain('PersonDossierContent');
    expect(person).toContain('PersonDetailPage');
    expect(tenant).toContain('TenantDossierContent');
    expect(tenant).toContain('TenantDetailPage');
  });
});
