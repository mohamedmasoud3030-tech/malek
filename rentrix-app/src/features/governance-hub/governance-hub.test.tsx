import { describe, expect, it } from 'vitest';
import { AuditLogPage, AuditLogWorkspace } from '@/features/audit/audit-log-page';
import { ChangePasswordPage, ChangePasswordWorkspace } from '@/features/auth/change-password-page';
import { DataIntegrityPage, DataIntegrityWorkspace } from '@/features/system/data-integrity-page';
import { SystemPage, SystemWorkspace } from '@/features/system/system-page';
import { AuditLogRouteComponent } from '@/routes/_protected.audit-log';
import { ChangePasswordRouteComponent } from '@/routes/_protected.change-password';
import { DataIntegrityRouteComponent } from '@/routes/_protected.data-integrity';
import { SettingsRouteComponent } from '@/routes/_protected.settings';
import { SystemRouteComponent } from '@/routes/_protected.system';
import { GovernanceHubPage } from './governance-hub-page';
import {
  getVisibleGovernanceHubSections,
  governanceHubSections,
  type GovernanceHubPermission,
} from './governance-hub-sections';

describe('governance hub permissions', () => {
  it('keeps only sections accepted by the shared permission seam', () => {
    const allowed = new Set<GovernanceHubPermission>([
      'settings.manage',
      'audit.view',
      'auth.password.change',
    ]);

    expect(getVisibleGovernanceHubSections((permission) => allowed.has(permission)).map((section) => section.id))
      .toEqual(['office', 'audit-log', 'security']);
  });

  it('returns no tabs when the session has no matching permission', () => {
    expect(getVisibleGovernanceHubSections(() => false)).toEqual([]);
  });

  it('maps every governance tab to a unique permission', () => {
    const permissions = governanceHubSections.map((section) => section.permission);
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});

describe('governance and legacy route wiring', () => {
  it('routes /settings to the governance hub', () => {
    expect(SettingsRouteComponent).toBe(GovernanceHubPage);
  });

  it('keeps legacy standalone routes wired to their original page entries', () => {
    expect(SystemRouteComponent).toBe(SystemPage);
    expect(AuditLogRouteComponent).toBe(AuditLogPage);
    expect(DataIntegrityRouteComponent).toBe(DataIntegrityPage);
    expect(ChangePasswordRouteComponent).toBe(ChangePasswordPage);
  });

  it('keeps every legacy page entry explicitly in standalone mode', () => {
    expect(SystemPage()).toMatchObject({ type: SystemWorkspace, props: { variant: 'standalone' } });
    expect(AuditLogPage()).toMatchObject({ type: AuditLogWorkspace, props: { variant: 'standalone' } });
    expect(DataIntegrityPage()).toMatchObject({ type: DataIntegrityWorkspace, props: { variant: 'standalone' } });
    expect(ChangePasswordPage()).toMatchObject({ type: ChangePasswordWorkspace, props: { variant: 'standalone' } });
  });
});
