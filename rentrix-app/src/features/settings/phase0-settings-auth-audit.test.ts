import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canAccess, getAuthorizationContextFromUser } from '@/features/auth/permissions';
import { paymentTermsIntervalValues } from './paymentTermsService';

const repoRoot = resolve(__dirname, '../../../..');

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('Phase 0 Settings + Auth audit invariants', () => {
  it('keeps settings services free of RPC calls until live parity says otherwise', () => {
    const serviceFiles = [
      'rentrix-app/src/features/settings/companySettingsService.ts',
      'rentrix-app/src/features/settings/costCenterService.ts',
      'rentrix-app/src/features/settings/paymentTermsService.ts',
    ];

    for (const file of serviceFiles) {
      expect(readRepoFile(file), file).not.toMatch(/\.rpc\s*\(/);
    }
  });

  it('keeps settings management restricted to admin and manager roles in frontend authorization', () => {
    const admin = getAuthorizationContextFromUser({ id: 'admin-1', email: 'admin@example.com', app_metadata: { user_role: 'ADMIN' } });
    const manager = getAuthorizationContextFromUser({ id: 'manager-1', email: 'manager@example.com', app_metadata: { user_role: 'MANAGER' } });
    const user = getAuthorizationContextFromUser({ id: 'user-1', email: 'user@example.com', app_metadata: { user_role: 'USER' } });

    expect(canAccess(admin, 'settings.manage')).toBe(true);
    expect(canAccess(manager, 'settings.manage')).toBe(true);
    expect(canAccess(user, 'settings.manage')).toBe(false);
  });

  it('keeps payment terms interval vocabulary aligned with the local migration check constraint', () => {
    const migration = readRepoFile('supabase/migrations/20260628000300_add_payment_terms.sql');

    for (const value of paymentTermsIntervalValues) {
      expect(migration).toContain(`'${value}'`);
    }
  });

  it('keeps the Phase 0 live evidence script read-only', () => {
    const script = readRepoFile('scripts/collect-phase0-settings-auth-evidence.sh');
    const sqlBody = script.slice(script.indexOf("<<'SQL'"));

    expect(sqlBody).toMatch(/information_schema\.columns/);
    expect(sqlBody).toMatch(/pg_get_functiondef\(p\.oid\)/);
    expect(sqlBody).not.toMatch(/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/i);
  });
});
