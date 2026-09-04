import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appPermissions, canAccess, getAuthorizationContextFromUser } from '@/features/auth/permissions';

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

  it('keeps settings management restricted to the dedicated admin authority in frontend authorization', () => {
    const admin = getAuthorizationContextFromUser({ id: 'admin-1', email: 'admin@example.com', app_metadata: { user_role: 'ADMIN' } });
    const manager = getAuthorizationContextFromUser({ id: 'manager-1', email: 'manager@example.com', app_metadata: { user_role: 'MANAGER' } });
    const user = getAuthorizationContextFromUser({ id: 'user-1', email: 'user@example.com', app_metadata: { user_role: 'USER' } });

    // company.settings.manage is the canonical settings authority. The legacy
    // settings.manage alias was retired: it had no route guard, navigation gate,
    // feature consumer, server reference or app_permission_catalog row.
    expect(canAccess(admin, 'company.settings.manage')).toBe(true);
    expect(canAccess(manager, 'company.settings.manage')).toBe(false);
    expect(canAccess(manager, 'permission_requests.review')).toBe(true);
    expect(canAccess(user, 'company.settings.manage')).toBe(false);
    expect(appPermissions as readonly string[]).not.toContain('settings.manage');
  });
});
