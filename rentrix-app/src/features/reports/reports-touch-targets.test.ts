import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const reportsDir = resolve(import.meta.dirname);

/**
 * Review-finding contract: every interactive control introduced or reworked by
 * the workspace consolidation must meet MALEK's 44px minimum touch target
 * (min-h-11) — compact visual styling (small font, restrained padding) is
 * allowed, a sub-44px clickable area is not.
 */
const PR_INTERACTIVE_FILES = [
  'components/PropertyAnalyticsSection.tsx',
  'components/OverviewSection.tsx',
  'components/FollowUpSection.tsx',
  'components/ExpiringContractsSection.tsx',
  'components/CollectionMovementSection.tsx',
  'components/OperationsOverviewSection.tsx',
  'workspace/WorkspaceSubViewTabs.tsx',
  'workspace/ReportsShell.tsx',
] as const;

describe('reports center — touch-target contract', () => {
  it('keeps every new interactive control at the 44px minimum target', () => {
    for (const file of PR_INTERACTIVE_FILES) {
      const source = readFileSync(resolve(reportsDir, file), 'utf8');
      expect(source, `${file} must not ship sub-44px interactive controls`).not.toMatch(/min-h-(8|9|10)\b/);
    }
  });

  it('keeps the property drill buttons at min-h-11', () => {
    const source = readFileSync(resolve(reportsDir, 'components/PropertyAnalyticsSection.tsx'), 'utf8');
    const drillTargets = source.match(/min-h-11 items-center rounded-lg border/g) ?? [];
    expect(drillTargets.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps the workspace sub-view tabs at min-h-11', () => {
    const source = readFileSync(resolve(reportsDir, 'workspace/WorkspaceSubViewTabs.tsx'), 'utf8');
    expect(source).toContain('min-h-11 items-center rounded-lg border');
    expect(source).not.toContain('min-h-9');
  });
});
