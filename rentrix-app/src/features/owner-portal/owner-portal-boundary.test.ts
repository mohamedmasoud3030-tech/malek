import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOwnerPortalSnapshot, OWNER_PORTAL_ALLOWED_PROJECTION_SOURCES } from './owner-portal-service';
import { OWNER_PORTAL_SECTIONS } from './owner-portal-read-model';

const featureDir = resolve(import.meta.dirname);

function featureFiles(): string[] {
  return readdirSync(featureDir).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
}

describe('Owner Portal read-only boundary', () => {
  it('accepts only the exported bearer token and fails closed otherwise', async () => {
    expect(await loadOwnerPortalSnapshot(undefined)).toEqual({
      status: 'invalid',
      reason: 'OWNER_PORTAL_LINK_REQUIRED',
    });
    expect(await loadOwnerPortalSnapshot('owner-123')).toEqual({
      status: 'invalid',
      reason: 'OWNER_PORTAL_LINK_INVALID_OR_EXPIRED',
    });
  });

  it('keeps the projection limited to owner-scoped read sources', () => {
    expect(OWNER_PORTAL_ALLOWED_PROJECTION_SOURCES).toEqual([
      'owners',
      'property_owners',
      'properties',
      'units',
      'contracts',
      'owner_settlements',
      'maintenance_records',
      'attachments',
    ]);
    expect(OWNER_PORTAL_SECTIONS).toEqual(['summary', 'portfolio', 'settlements', 'maintenance', 'documents']);
  });

  it('contains no office-core browser mutation in the portal feature source', () => {
    for (const file of featureFiles()) {
      const source = readFileSync(resolve(featureDir, file), 'utf8');
      expect(source, `${file} must not write through the browser client`).not.toMatch(
        /\.from\s*\(\s*['"][^'"]+['"]\s*\)\s*\.(insert|update|delete|upsert)\s*\(/,
      );
    }
  });

  it('never accepts ownerId or companyId from the portal browser service', () => {
    const source = readFileSync(resolve(featureDir, 'owner-portal-service.ts'), 'utf8');
    expect(source).not.toMatch(/p_owner_id|p_company_id|companyId\s*:/);
    expect(source).toContain("rpc('get_owner_portal_snapshot'");
    expect(source).toContain('p_token');
  });

  it('stays outside office shell and remains compact', () => {
    for (const file of featureFiles()) {
      const source = readFileSync(resolve(featureDir, file), 'utf8');
      expect(source, `${file} must not import office shell`).not.toMatch(
        /from\s+['"].*(app-shell|layout-navigation|features\/finance|features\/financials|services\/documents)/,
      );
      expect(statSync(resolve(featureDir, file)).size, `${file} must stay small`).toBeLessThan(20_000);
    }
  });
});
