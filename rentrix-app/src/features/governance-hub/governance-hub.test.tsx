import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AuditLogPage, AuditLogWorkspace } from '@/features/audit/audit-log-page';
import { ChangePasswordPage, ChangePasswordWorkspace } from '@/features/auth/change-password-page';
import { SettingsPage, SettingsWorkspace } from '@/features/settings/settings-page';
import { DataIntegrityPage, DataIntegrityWorkspace } from '@/features/system/data-integrity-page';
import { SystemPage, SystemWorkspace } from '@/features/system/system-page';
import {
  getAccessibleGovernanceHubSections,
  getVisibleGovernanceHubSections,
  governanceHubSections,
  type GovernanceHubPermission,
} from './governance-hub-sections';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const routeTreeSource = readSource('../../app/router/route-tree.ts');

describe('governance hub permissions', () => {
  it('shows only routine settings in primary navigation', () => {
    const allowed = new Set<GovernanceHubPermission>([
      'company.settings.manage',
      'audit.view',
      'auth.password.change',
    ]);

    expect(getAccessibleGovernanceHubSections((permission) => allowed.has(permission)).map((section) => section.id))
      .toEqual(['company', 'audit-log', 'security']);
    expect(getVisibleGovernanceHubSections((permission) => allowed.has(permission)).map((section) => section.id))
      .toEqual(['company']);
  });

  it('keeps duplicate/technical/support settings addressable but out of routine tabs', () => {
    const hidden = governanceHubSections
      .filter((section) => !section.showInPrimaryNavigation)
      .map((section) => section.id);

    expect(hidden).toEqual(['cost-centers', 'automation', 'system-settings', 'audit-log', 'data-integrity', 'security']);
  });

  it('returns no tabs when the session has no matching permission', () => {
    expect(getVisibleGovernanceHubSections(() => false)).toEqual([]);
    expect(getAccessibleGovernanceHubSections(() => false)).toEqual([]);
  });

  it('maps every governance surface to a unique permission', () => {
    const permissions = governanceHubSections.map((section) => section.permission);
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});

describe('governance and legacy route wiring', () => {
  it('routes /settings directly to the governance hub', () => {
    expect(routeTreeSource).toContain("import('@/features/governance-hub/components/GovernanceHubWorkspace')");
    expect(routeTreeSource).toContain("'GovernanceHubWorkspace'");
  });

  it('keeps advanced settings surfaces as redirect-only URL aliases (workspace lives in the hub)', () => {
    for (const route of ['/system', '/audit-log', '/data-integrity', '/change-password']) {
      const idx = routeTreeSource.indexOf(`path: '${route}'`);
      const block = routeTreeSource.slice(routeTreeSource.lastIndexOf('createRoute({', idx), routeTreeSource.indexOf('});', idx) + 3);
      expect(block).toContain("settingsLegacyRedirect(");
      expect(block).not.toContain('lazyRouteComponent');
    }
    // The page entries themselves are composed inside the governance hub.
    expect(routeTreeSource).not.toContain("import('@/features/system/system-page')");
    expect(routeTreeSource).not.toContain("import('@/features/audit/audit-log-page')");
    expect(routeTreeSource).not.toContain("import('@/features/system/data-integrity-page')");
    expect(routeTreeSource).not.toContain("import('@/features/auth/change-password-page')");
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

  it('keeps visited workspace content mounted so unsaved drafts survive switches', () => {
    const source = readSource('./components/GovernanceHubWorkspace.tsx');

    expect(source).toContain('const [mountedTabs, setMountedTabs]');
    expect(source).toContain('mountedTabs.has(tab)');
    expect(source).not.toContain('key={resolvedActiveTab}');
  });

  it('renders a single visible settings tab controller', () => {
    const source = readSource('./components/GovernanceHubWorkspace.tsx');

    expect(source).toContain('getAccessibleGovernanceHubSections');
    expect(source).toContain('getVisibleGovernanceHubSections');
    expect(source).toContain('items={visibleSections}');
    expect(source).toContain('<SectionTabs');
    expect(source).not.toContain('WorkspaceSubNav');
    expect(source).not.toContain('التنقل الداخلي لمساحة العمل');
  });

  it('owns nested company-settings URL state in the governance layer, not the settings controller', () => {
    const hub = readSource('./components/GovernanceHubWorkspace.tsx');
    const workspace = readSource('../settings/settings-page.tsx');
    const controller = readSource('../settings/useSettingsPageController.ts');

    expect(hub).toContain('resolveGovernanceHubNavigation');
    expect(hub).toContain('buildCompanySettingsSearch');
    expect(hub).toContain('activeSection={companySection}');
    expect(hub).toContain('onSectionChange={handleCompanySectionChange}');
    expect(workspace).toContain('activeSection: controlledActiveSection');
    expect(workspace).toContain('const requestedActiveSection = controlledActiveSection ?? localActiveSection');
    expect(workspace).toContain('const activeSection = accessibleDefinitions.some');
    expect(controller).not.toContain('useNavigate');
    expect(controller).not.toContain('useSearch');
  });
});