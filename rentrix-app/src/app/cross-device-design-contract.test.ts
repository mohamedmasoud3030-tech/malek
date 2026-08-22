import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

/**
 * Cross-device design unification contract (UX-001 / UX-008).
 * Locks phone / iPad / desktop chrome so remaining pages stay on one surface.
 */
describe('cross-device design unification', () => {
  const shell = source('app/layout/app-shell.tsx');
  const nav = source('app/layout/layout-navigation-view.tsx');
  const palette = source('features/command-palette/command-palette-trigger.tsx');
  const pageHeader = source('components/layout/page-header.tsx');
  const detailHeader = source('components/layout/entity-detail-header.tsx');
  const ux = source('styles/ux-foundation.css');
  const propertyDetail = source('features/properties/property-detail-page.tsx');
  const operationsHub = source('features/operations-hub/operations-hub-workspace.tsx');
  const financials = source('features/financials/financials-page.tsx');
  const reports = source('features/reports/reports-page.tsx');
  const assistant = source('features/ai-assistant/ai-assistant-page.tsx');

  it('keeps the mobile menu trigger on the floating dock (md:hidden), never in the header', () => {
    // Mobile architecture reset (#1545/#1547): the phone/iPad menu trigger is
    // the dock button (data-mobile-dock-menu) inside the floating control;
    // there is no header hamburger anymore.
    expect(nav).toContain('data-mobile-dock-menu');
    expect(nav).toContain('size-11');
    expect(nav).toContain('md:hidden');
    expect(shell).not.toContain('data-mobile-menu-trigger');
  });

  it('keeps the floating Menu + Search control on phones only', () => {
    expect(nav).toContain('data-mobile-floating-control');
    expect(nav).toContain('md:hidden');
    expect(nav).not.toContain('lg:hidden" data-mobile-floating-control');
  });

  it('exposes header search on tablet and desktop', () => {
    expect(palette).toContain('hidden md:flex');
    expect(palette).not.toContain('hidden lg:flex');
  });

  it('unifies page and dossier headers on the elevated token radius', () => {
    expect(pageHeader).toContain('rounded-2xl');
    expect(detailHeader).toContain('rounded-2xl');
    expect(pageHeader).toContain('data-unified-surface="page-header"');
    expect(detailHeader).toContain('data-unified-surface="page-header"');
    expect(pageHeader).not.toContain('rounded-[1.5rem]');
    expect(detailHeader).not.toContain('rounded-[1.5rem]');
  });

  it('reserves floating-control clearance for phone widths only', () => {
    expect(ux).toContain('@media (max-width: 767px)');
    expect(ux).toContain('var(--mobile-floating-control-height)');
    expect(ux).not.toContain('@media (max-width: 1023px)');
  });

  it('renders property dossier content once for phone, tablet, and desktop', () => {
    expect(propertyDetail).toContain('data-property-detail-body');
    expect(propertyDetail).toContain('data-property-detail-mobile-nav');
    const bodyBlocks = propertyDetail.match(/data-property-detail-body/g) ?? [];
    expect(bodyBlocks).toHaveLength(1);
    expect(propertyDetail).not.toContain('md:hidden\">\n            {tab ===');
  });

  it('keeps remaining hubs on the same visual wave and hint surface', () => {
    expect(operationsHub).toContain('visualVariant="malek-pro"');
    // Dense-register redesign (#1545): /financials navigates via WorkspaceNav,
    // /reports keeps the WorkspaceHint surface.
    expect(financials).toContain('WorkspaceNav');
    expect(reports).toContain('WorkspaceHint');
    expect(financials).not.toContain('💡');
    expect(reports).not.toContain('💡');
  });

  it('shows AI capabilities before the first reply and documents send shortcuts', () => {
    expect(assistant).toContain('data-ai-capabilities');
    expect(assistant).toContain('Enter للإرسال');
    expect(assistant).toContain('md:grid-cols-[minmax(0,1fr)_20rem]');
  });
});
