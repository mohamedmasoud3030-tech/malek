import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Financials mounted-but-hidden diagnostic — Phase 1 inventory.
 *
 * Current financials-page.tsx keeps previously visited views mounted
 * (`mountedViews.current` + `hidden={!isActive}`) so filters/forms
 * survive a tab switch. This is intentional UX polish, but it:
 *   - keeps up to 8 workspace data fetches mounted,
 *   - holds form state for invisible views,
 *   - risks stale-data flash on revisit.
 *
 * Phase 1 does NOT redesign Finance. This test pins the current behavior
 * so Phase 2 can measure the cost and decide whether to unmount vs keep
 * mounted. If someone silently switches to unmount-all, this test breaks
 * and forces an explicit decision + doc update.
 */

const source = readFileSync(new URL('./financials-page.tsx', import.meta.url), 'utf8');

describe('financials mounted-but-hidden — behavior inventory', () => {
  it('documents that visited views stay mounted and are hidden (not unmounted)', () => {
    // Mounted set pattern
    expect(source).toContain('mountedViews');
    expect(source).toContain('mountedViews.current.add');
    expect(source).toContain('shouldRenderView');
    // Hidden-but-mounted panels
    expect(source).toMatch(/hidden=\{activeSection !==/);
    expect(source).toMatch(/hidden=\{activeSection !== .* \|\| activeView !==/);
  });

  it('requires that hidden panels still render Suspense workspaces (data stays fetched)', () => {
    // Each view is guarded by shouldRenderView && hidden — meaning the lazy workspace
    // stays in DOM once visited. That's the mounted-but-hidden seam.
    const viewPanels = (source.match(/shouldRenderView\('/g) ?? []).length;
    expect(viewPanels).toBeGreaterThanOrEqual(7);
    expect(source).toContain('InvoicesWorkspace');
    expect(source).toContain('ReceiptsWorkspace');
    expect(source).toContain('ExpensesWorkspace');
    expect(source).toContain('CommissionsWorkspace');
  });

  it('at least exposes the perf/accessibility trade-off via data-attributes', () => {
    // Each panel should be a tabpanel with hidden semantics so AT can ignore it
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('id="section-panel-');
  });

  it('flags if someone removes the mountedViews ref without updating FOUNDATION.md', () => {
    // If future code uncomment this to fully unmount inactive views:
    // this test must be updated and FOUNDATION.md §5 amended.
    const hasMountedViewsRef = source.includes('useRef(new Set<string>())') || source.includes('mountedViews.current');
    expect(hasMountedViewsRef).toBe(true);
  });

  // Measurement note (not a test): unmounting would improve memory & fresh-fetch,
  // but would lose unsaved filter/form state. Phase 2 should decide per-view
  // (e.g. keep overview mounted, unmount receipts/arrears, or add explicit
  // keepAlive prop). Keep this file as the regression lock.
});
