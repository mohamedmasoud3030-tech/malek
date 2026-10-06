import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTenantPortalSnapshot } from './tenant-portal-service';
import { TENANT_PORTAL_V1_SECTIONS, isTenantPortalSectionId } from './tenant-portal-read-model';

const featureDir = resolve(import.meta.dirname);

function featureFiles(): string[] {
  return readdirSync(featureDir).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
}

describe('tenant portal v1 boundary', () => {
  it('exposes exactly the canonical read-only v1 sections and nothing else', () => {
    expect(TENANT_PORTAL_V1_SECTIONS).toEqual([
      'identity',
      'unit_contract',
      'due_schedule',
      'position',
      'services',
      'receipts',
      'documents',
      'maintenance',
    ]);
    for (const id of TENANT_PORTAL_V1_SECTIONS) {
      expect(isTenantPortalSectionId(id)).toBe(true);
    }
    expect(isTenantPortalSectionId('office_settings')).toBe(false);
  });

  it('fails closed before any RPC call when the secure link token is absent', async () => {
    expect(await loadTenantPortalSnapshot(undefined)).toEqual({
      status: 'invalid',
      reason: 'TENANT_PORTAL_LINK_REQUIRED',
    });
    expect(await loadTenantPortalSnapshot('not-a-token')).toEqual({
      status: 'invalid',
      reason: 'TENANT_PORTAL_LINK_INVALID_OR_EXPIRED',
    });
  });

  it('contains no office-core browser mutation in the portal feature source', () => {
    for (const file of featureFiles()) {
      const source = readFileSync(resolve(featureDir, file), 'utf8');
      expect(source, `${file} must not write through the browser client`).not.toMatch(
        /\.from\s*\(\s*['"][^'"]+['"]\s*\)\s*\.(insert|update|delete|upsert)\s*\(/,
      );
    }
  });

  it('stays a leaf: no office shell/navigation or office finance module import', () => {
    for (const file of featureFiles()) {
      const source = readFileSync(resolve(featureDir, file), 'utf8');
      expect(source, `${file} must not import office shell`).not.toMatch(
        /from\s+['"].*(app-shell|layout-navigation|features\/finance|features\/financials|services\/documents)/,
      );
    }
  });

  it('never accepts tenantId or companyId from the portal browser service', () => {
    const source = readFileSync(resolve(featureDir, 'tenant-portal-service.ts'), 'utf8');
    expect(source).not.toMatch(/p_tenant_id|p_company_id|companyId\s*:/);
    expect(source).toContain("rpc('get_tenant_portal_snapshot'");
    expect(source).toContain('p_token');
  });

  it('keeps the page self-contained', () => {
    for (const file of featureFiles()) {
      const size = statSync(resolve(featureDir, file)).size;
      expect(size, `${file} must stay small (bundle pressure)`).toBeLessThan(20_000);
    }
  });
});
