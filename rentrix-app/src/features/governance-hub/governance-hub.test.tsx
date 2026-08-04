import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AuditLogPage, AuditLogWorkspace } from '@/features/audit/audit-log-page';
import { ChangePasswordPage, ChangePasswordWorkspace } from '@/features/auth/change-password-page';
import { SettingsPage, SettingsWorkspace } from '@/features/settings/settings-page';
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

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

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

  it('keeps every page entry explicitly in standalone mode', () => {
    expect(SettingsPage()).toMatchObject({ type: SettingsWorkspace, props: { variant: 'standalone' } });
    expect(SystemPage()).toMatchObject({ type: SystemWorkspace, props: { variant: 'standalone' } });
    expect(AuditLogPage()).toMatchObject({ type: AuditLogWorkspace, props: { variant: 'standalone' } });
    expect(DataIntegrityPage()).toMatchObject({ type: DataIntegrityWorkspace, props: { variant: 'standalone' } });
    expect(ChangePasswordPage()).toMatchObject({ type: ChangePasswordWorkspace, props: { variant: 'standalone' } });
  });
});

describe('embedded workspace architecture contract', () => {
  const contracts = [
    ['../settings/settings-page.tsx', 'SettingsPage', 'SettingsWorkspace'],
    ['../system/system-page.tsx', 'SystemPage', 'SystemWorkspace'],
    ['../audit/audit-log-page.tsx', 'AuditLogPage', 'AuditLogWorkspace'],
    ['../system/data-integrity-page.tsx', 'DataIntegrityPage', 'DataIntegrityWorkspace'],
    ['../auth/change-password-page.tsx', 'ChangePasswordPage', 'ChangePasswordWorkspace'],
  ] as const;

  it.each(contracts)('%s exposes embedded mode while preserving its standalone page wrapper', (path, page, workspace) => {
    const source = readSource(path);
    const standaloneWrapper = new RegExp(
      `export function ${page}\\(\\)\\s*\\{\\s*return <${workspace} variant=["']standalone["'] \\/>;\\s*\\}`,
      'm',
    );

    expect(source).toContain("variant === 'embedded'");
    expect(source).toMatch(standaloneWrapper);
  });

  it('keeps visited tab workspaces mounted so unsaved drafts survive tab switches', () => {
    const source = readSource('./components/GovernanceHubWorkspace.tsx');

    expect(source).toContain('const [mountedTabs, setMountedTabs]');
    expect(source).toContain('mountedTabs.has(tab)');
    expect(source).not.toContain('key={resolvedActiveTab}');
  });

  it('renders a single navigation controller — SectionTabs, no duplicate WorkspaceSubNav', () => {
    const source = readSource('./components/GovernanceHubWorkspace.tsx');

    // SectionTabs is the one section navigation surface for this workspace.
    expect(source).toContain('<SectionTabs');
    // The duplicated WorkspaceSubNav row must not re-render the same section
    // set, which previously stacked two horizontal navigation menus on mobile.
    expect(source).not.toContain('WorkspaceSubNav');
    expect(source).not.toContain('التنقل الداخلي لمساحة العمل');
  });
});
