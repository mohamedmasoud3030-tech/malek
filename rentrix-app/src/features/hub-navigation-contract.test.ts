import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Stage 1 — duplicate-navigation prevention across every consolidated hub.
 *
 * Each consolidated hub workspace must render exactly ONE section navigation
 * controller. Historically the standalone shells rendered BOTH <WorkspaceSubNav>
 * (a secondary bar listing child destinations) and <SectionTabs> for the same
 * section set, which produced two overlapping horizontal navigation rows on
 * desktop and stacked two horizontal menus on mobile. SectionTabs is the
 * single controller; the duplicate WorkspaceSubNav row is removed.
 *
 * Deep links are preserved by the route layer: legacy child routes
 * (/owners, /invoices, ...) still redirect into the hub with ?section=.
 */
const HUB_WORKSPACES = [
  'finance-hub/finance-hub-workspace.tsx',
  'portfolio-hub/portfolio-hub-workspace.tsx',
  'operations-hub/operations-hub-workspace.tsx',
  'relationships-hub/relationships-hub-workspace.tsx',
  'governance-hub/components/GovernanceHubWorkspace.tsx',
] as const;

function readSource(relativePath: string): string {
  return readFileSync(new URL(`./${relativePath}`, import.meta.url), 'utf8');
}

describe('hub navigation — one section navigation surface per state', () => {
  it.each(HUB_WORKSPACES)('%s keeps SectionTabs and drops the duplicated WorkspaceSubNav row', (path) => {
    const source = readSource(path);

    expect(source, `${path} must render SectionTabs as its section controller`).toContain('<SectionTabs');
    expect(source, `${path} must not render a duplicated WorkspaceSubNav row`).not.toContain('WorkspaceSubNav');
    expect(source, `${path} must not render a duplicated secondary-nav aria label`).not.toContain(
      'التنقل الداخلي لمساحة العمل',
    );
  });

  it('each hub workspace renders SectionTabs as its sole section controller', () => {
    for (const path of HUB_WORKSPACES) {
      const source = readSource(path);
      const sectionTabsCount = (source.match(/<SectionTabs/g) ?? []).length;
      // Exactly one SectionTabs instance drives section state per hub workspace.
      expect(sectionTabsCount, `${path} should expose exactly one SectionTabs`).toBe(1);
    }
  });
});
