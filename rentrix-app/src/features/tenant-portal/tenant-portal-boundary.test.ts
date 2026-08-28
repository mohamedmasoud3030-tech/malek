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

  it('loads through the deferred boundary while the upstream read model is unavailable', async () => {
    expect(await loadTenantPortalSnapshot()).toEqual({
      status: 'deferred',
      reason: 'TENANT_PORTAL_READ_MODEL_UNAVAILABLE',
    });
  });

  it('contains no office-core mutation call in the feature source', () => {
    for (const file of featureFiles()) {
      const source = readFileSync(resolve(featureDir, file), 'utf8');
      expect(
        source,
        `${file} must not write through the browser client`,
      ).not.toMatch(/\.from\s*\(\s*['"][^'"]+['"]\s*\)\s*\.(insert|update|delete|upsert)\s*\(/);
    }
  });

  it('stays a leaf: no office shell/navigation import and no finance RPC import', () => {
    for (const file of featureFiles()) {
      const source = readFileSync(resolve(featureDir, file), 'utf8');
      expect(source, `${file} must not import office shell`).not.toMatch(
        /from\s+['"].*(app-shell|layout-navigation|features\/finance|features\/financials|services\/documents)/,
      );
    }
  });

  it('keeps the page self-contained (no oversized feature modules)', () => {
    for (const file of featureFiles()) {
      const size = statSync(resolve(featureDir, file)).size;
      expect(size, `${file} must stay small (bundle pressure)`).toBeLessThan(20_000);
    }
  });
});
