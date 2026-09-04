import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('detail workspace consistency', () => {
  it('keeps long owner, tenant, and provider dossiers behind focused sections', () => {
    const ownerView = read('./owners/components/owner-detail-view.tsx');
    const ownerBody = read('./owners/components/owner-dossier-body.tsx');
    const tenant = read('./tenants/components/TenantPreviewDialog.tsx');
    const provider = read('./service-providers/service-provider-detail-page.tsx');
    const person = read('./people/components/PersonDossier.tsx');
    const land = read('./lands/components/LandDossier.tsx');

    expect(ownerView).toContain('ariaLabel="أقسام ملف المالك"');
    expect(ownerBody).not.toContain("data-owner-detail-financials");
    expect(ownerView).toContain('المالية التفصيلية في مساحة المال والتقارير');
    expect(tenant).toContain('ariaLabel="أقسام ملف المستأجر"');
    expect(tenant).toContain('section={activeSection}');
    expect(provider).toContain('ariaLabel="أقسام ملف مزود الخدمة"');
    expect(provider).toContain('data-provider-detail-operations');
    expect(person).toContain('ariaLabel="أقسام ملف الشخص"');
    expect(person).toContain('section={activeSection}');
    expect(land).toContain('ariaLabel="أقسام ملف الأرض"');
    expect(land).toContain('section={activeSection}');
  });

  it('keeps quick preview separate from explicit full-detail navigation', () => {
    const units = read('./units/units-page.tsx');
    const owners = read('./owners/components/owner-workspace-table.tsx');
    const tenants = read('./tenants/TenantsPage.tsx');

    expect(units).toContain('<UnitPreviewDialog');
    expect(units).toContain('onRowClick={openPreview}');
    expect(units).toContain('التفاصيل الكاملة');

    expect(owners).toContain('<OwnerPreviewDialog');
    expect(owners).toContain('onRowClick={(row) => openPreview(row.owner.id)}');
    expect(owners).not.toContain('state: { backgroundLocation: location }');

    expect(tenants).toContain('<TenantPreviewDialog');
    expect(tenants).toContain('onRowClick={openPreview}');
    expect(tenants).toContain("to: '/tenants/$tenantId'");
    expect(tenants).not.toContain('useDialogNavigate');
    expect(tenants).not.toContain('backgroundLocation');
  });
});
