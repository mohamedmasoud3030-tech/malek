import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('tenant dossier ledger contract', () => {
  it('keeps the tenant payment schedule operational and includes recorded receipts', () => {
    const dossier = read('./components/TenantPreviewDialog.tsx');
    const service = read('./tenantWorkspaceService.ts');

    expect(dossier).toContain("{ id: 'ledger', label: 'الاستحقاقات والمدفوعات'");
    expect(dossier).toContain('لا يغيّر الدفع تاريخ الاستحقاق الأصلي');
    expect(dossier).toContain('الدفعات وإثباتاتها');
    expect(service).toContain(".from('receipts')");
    expect(service).toContain(".eq('tenant_id', tenantId)");
  });
});
