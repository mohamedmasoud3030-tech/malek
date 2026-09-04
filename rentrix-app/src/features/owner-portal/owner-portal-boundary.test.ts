import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOwnerPortalSnapshot, OWNER_PORTAL_ALLOWED_PROJECTION_SOURCES } from './owner-portal-service';
import { OWNER_PORTAL_SECTIONS } from './owner-portal-read-model';

const featureDir = resolve(import.meta.dirname);
const portalProjectionMigration = resolve(featureDir, '../../../../supabase/migrations/20260901000045_owner_portal_canonical_projection.sql');
const portalCompanyScopeMigration = resolve(featureDir, '../../../../supabase/migrations/20260901000062_owner_portal_vault_company_scope.sql');
// Current authority for the public Owner Portal snapshot after the bounded
// projection migration (also removes the migration-45 legacy wrapper seam).
const portalBoundedMigration = resolve(featureDir, '../../../../supabase/migrations/20260904000000_bound_anonymous_portal_projections.sql');

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
      'vault_documents',
    ]);
    expect(OWNER_PORTAL_SECTIONS).toEqual(['summary', 'portfolio', 'settlements', 'maintenance', 'documents']);
  });

  it('uses canonical vault metadata and keeps the legacy projection private', () => {
    const source = readFileSync(portalProjectionMigration, 'utf8');
    expect(source).toContain('from public.vault_documents vd');
    expect(source).not.toMatch(/jsonb_build_object\([\s\S]*?['"]storage(Path|_path|Url|_url)['"]/i);
    expect(source).toContain('set schema app_private');
    expect(source).toContain('revoke all on function app_private.get_owner_portal_snapshot_legacy(uuid)');
  });

  it('scopes owner portal vault documents to the bearer-token company', () => {
    const source = readFileSync(portalCompanyScopeMigration, 'utf8');
    expect(source).toContain('from public.vault_documents vd');
    expect(source).toContain('where vd.company_id = v_company');
    expect(source).toContain('and vd.deleted_at is null');
    expect(source).toContain('l.revoked_at is null');
    expect(source).toContain('l.expires_at > now()');
  });

  it('does not count paid settlements as currently payable', () => {
    const source = readFileSync(portalProjectionMigration, 'utf8');
    expect(source).toContain("in ('DRAFT', 'APPROVED')");
    expect(source).not.toMatch(/PAID[\s\S]{0,100}net_payable|net_payable[\s\S]{0,100}PAID/i);
  });

  it('bounds every anon-facing list to a 50-row window with an honest total', () => {
    const source = readFileSync(portalBoundedMigration, 'utf8');
    const ownerBody = source.slice(
      source.indexOf('create or replace function public.get_owner_portal_snapshot'),
    );
    expect(ownerBody.match(/row_number\(\) over/g)?.length).toBe(5);
    expect(ownerBody.match(/filter \(where r\.rn <= 50\)/g)?.length).toBe(5);
    for (const total of [
      'propertiesTotal',
      'unitsTotal',
      'settlementsTotal',
      'maintenanceTotal',
      'documentsTotal',
    ]) {
      expect(ownerBody).toContain(`'${total}'`);
    }
  });

  it('keeps summary aggregates complete while lists are bounded', () => {
    const source = readFileSync(portalBoundedMigration, 'utf8');
    const ownerBody = source.slice(
      source.indexOf('create or replace function public.get_owner_portal_snapshot'),
    );
    // grossCollected/ownerExpenses aggregate the complete ranked set, and the
    // payable rule stays DRAFT+APPROVED over the full settlement table.
    expect(ownerBody).toContain("in ('APPROVED','PAID') then r.gross_collected");
    expect(ownerBody).toContain("in ('DRAFT', 'APPROVED')");
    expect(ownerBody).toContain('from public.owner_settlements s');
  });

  it('is self-contained and removes the superseded legacy projection seam', () => {
    const source = readFileSync(portalBoundedMigration, 'utf8');
    const ownerBody = source.slice(
      source.indexOf('create or replace function public.get_owner_portal_snapshot'),
    );
    const legacyRefs = ownerBody.match(/app_private\.get_owner_portal_snapshot_legacy\(/g) ?? [];
    // The ONLY reference left is the removal itself: no runtime reuse.
    expect(legacyRefs.length).toBe(1);
    expect(ownerBody).toContain('drop function if exists app_private.get_owner_portal_snapshot_legacy(uuid);');
    // Canonical vault metadata scope and company isolation from v45/v62 carry over.
    expect(ownerBody).toContain('from public.vault_documents vd');
    expect(ownerBody).toContain('where vd.company_id = v_company');
    expect(ownerBody).not.toMatch(/from\s+public\.attachments\b/);
    expect(ownerBody).not.toContain('file_url');
    expect(ownerBody).not.toContain('storage_path');
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
