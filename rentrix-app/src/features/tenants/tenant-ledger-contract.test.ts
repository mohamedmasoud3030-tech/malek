import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('tenant dossier ledger contract', () => {
  it('keeps the tenant payment schedule operational and includes recorded receipts on the full dossier', () => {
    const tenant = read('./components/TenantPreviewDialog.tsx');
    const service = read('./tenantWorkspaceService.ts');

    expect(tenant).toContain('TenantDetailPage');
    expect(tenant).toContain('TenantDossierContent');
    // The ledger is deep-work: it lives on the full file, not inside the
    // glance-first Quick Preview.
    expect(tenant).toContain("id: 'ledger', label: 'الاستحقاقات والمدفوعات'");
    expect(tenant).toContain('لا يغيّر الدفع تاريخ الاستحقاق الأصلي');
    expect(service).toContain(".from('receipts')");
    expect(service).toContain(".eq('tenant_id', tenantId)");
  });

  it('keeps the quick preview glance-first without a ledger table', () => {
    const preview = read('./components/TenantPreviewDialog.tsx');
    const previewModuleStart = preview.indexOf('export function TenantPreviewDialog');
    const previewModule = preview.slice(previewModuleStart);
    expect(previewModule).toContain('PreviewFacts');
    expect(previewModule).not.toContain("id: 'ledger'");
    expect(previewModule).not.toContain('سجل الاستحقاقات والمدفوعات');
  });
});
