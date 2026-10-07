import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Duplicate-navigation prevention after the navigation architecture
 * consolidation.
 *
 * The consolidated hubs (relationships/operations/governance/portfolio) were
 * dismantled: every business entity is now a standalone canonical route, so
 * there is no hub workspace left to audit. The invariant they were created to
 * protect still applies to the standalone surfaces that survived — a workspace
 * that offers section navigation must render exactly ONE section navigation
 * controller. Historically these shells rendered BOTH <WorkspaceSubNav> (a
 * secondary bar listing child destinations) and <SectionTabs> for the same
 * section set, producing two overlapping horizontal navigation rows on desktop
 * and stacked menus on mobile. SectionTabs is the single controller.
 *
 * Legacy deep links are preserved by the route layer: retired hub query URLs
 * (?section= / ?view= / ?workspace=) hard redirect to the canonical standalone
 * destination instead of re-opening a hub shell.
 */
const STANDALONE_SECTION_WORKSPACES = [
  'contracts/components/ContractDetailWorkspace.tsx',
  'lands/components/LandDossier.tsx',
  'owners/components/owner-detail-view.tsx',
  'people/components/PersonDossier.tsx',
  'reports/premium/report-product-page.tsx',
  'service-providers/service-provider-detail-page.tsx',
  'tenants/components/TenantPreviewDialog.tsx',
] as const;

function readSource(relativePath: string): string {
  return readFileSync(new URL(`./${relativePath}`, import.meta.url), 'utf8');
}

describe('section navigation — one section navigation surface per standalone workspace', () => {
  it.each(STANDALONE_SECTION_WORKSPACES)('%s keeps SectionTabs and drops the duplicated WorkspaceSubNav row', (path) => {
    const source = readSource(path);

    expect(source, `${path} must render SectionTabs as its section controller`).toContain('<SectionTabs');
    expect(source, `${path} must not render a duplicated WorkspaceSubNav row`).not.toContain('WorkspaceSubNav');
    expect(source, `${path} must not render a duplicated secondary-nav aria label`).not.toContain(
      'التنقل الداخلي لمساحة العمل',
    );
  });

  it('each standalone workspace renders SectionTabs as its sole section controller', () => {
    for (const path of STANDALONE_SECTION_WORKSPACES) {
      const source = readSource(path);
      const sectionTabsCount = (source.match(/<SectionTabs/g) ?? []).length;
      // Exactly one SectionTabs instance drives section state per workspace.
      expect(sectionTabsCount, `${path} should expose exactly one SectionTabs`).toBe(1);
    }
  });

  it('keeps every retired hub workspace out of the source tree', () => {
    const { existsSync } = require('node:fs') as typeof import('node:fs');
    for (const retired of [
      './operations-hub/operations-hub-workspace.tsx',
      './governance-hub/components/GovernanceHubWorkspace.tsx',
      './portfolio-hub/portfolio-hub-workspace.tsx',
      './relationships-hub/leasing-hub-workspace.tsx',
    ]) {
      expect(existsSync(new URL(retired, import.meta.url)), `${retired} must stay dismantled`).toBe(false);
    }
  });
});
