import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('detail workspace consistency', () => {
  it('keeps long owner, tenant, and provider dossiers behind focused sections', () => {
    const ownerView = read('./owners/components/owner-detail-view.tsx');
    const ownerBody = read('./owners/components/owner-dossier-body.tsx');
    const tenant = read('./tenants/components/TenantPreviewDialog.tsx');
    const provider = read('./service-providers/service-provider-detail-page.tsx');

    expect(ownerView).toContain('ariaLabel="أقسام ملف المالك"');
    expect(ownerBody).toContain("data-owner-detail-financials");
    expect(tenant).toContain('ariaLabel="أقسام ملف المستأجر"');
    expect(tenant).toContain('section={activeSection}');
    expect(provider).toContain('ariaLabel="أقسام ملف مزود الخدمة"');
    expect(provider).toContain('data-provider-detail-operations');
  });
});
