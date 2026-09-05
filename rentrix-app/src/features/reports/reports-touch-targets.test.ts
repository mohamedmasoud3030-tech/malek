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
  'premium/report-product-page.tsx',
  'components/report-document-actions.tsx',
] as const;

describe('reports center — touch-target contract', () => {
  it('keeps every new interactive control at the 44px minimum target', () => {
    for (const file of PR_INTERACTIVE_FILES) {
      const source = readFileSync(resolve(reportsDir, file), 'utf8');
      expect(
        source,
        `${file} must not ship sub-44px interactive controls`,
      ).not.toMatch(/min-h-(8|9|10)\b/);
    }
  });

  /**
   * Property Analytics no longer styles its own drill buttons: it composes the
   * canonical `ReportDrillAction`, which owns the 44px target. The contract
   * therefore locks the canonical usage plus the primitive's own target.
   */
  it('routes property drill affordances through the canonical ReportDrillAction', () => {
    const source = readFileSync(
      resolve(reportsDir, 'components/PropertyAnalyticsSection.tsx'),
      'utf8',
    );
    const drillTargets = source.match(/<ReportDrillAction/g) ?? [];
    expect(drillTargets.length).toBeGreaterThanOrEqual(5);
    expect(source).not.toMatch(/<button/);

    const primitive = readFileSync(
      resolve(reportsDir, '../../components/ui/report-section-primitives.tsx'),
      'utf8',
    );
    expect(primitive).toContain('min-h-11 shrink-0 gap-1.5');
  });

  it('keeps canonical product target tabs at min-h-11', () => {
    const source = readFileSync(
      resolve(reportsDir, 'premium/report-product-page.tsx'),
      'utf8',
    );
    expect(source).toContain('data-report-product-tabs');
    expect(source).toContain('role="tab"');
    expect(source).toContain('min-h-11 rounded-lg');
    expect(source).not.toContain('min-h-9');
  });
});
