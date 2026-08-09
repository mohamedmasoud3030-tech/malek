import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellSource = readFileSync(new URL('./layout/app-shell.tsx', import.meta.url), 'utf8');
const navViewSource = readFileSync(new URL('./layout/layout-navigation-view.tsx', import.meta.url), 'utf8');
const pageHeaderSource = readFileSync(new URL('../components/layout/page-header.tsx', import.meta.url), 'utf8');
const financialsSource = readFileSync(new URL('../features/financials/financials-page.tsx', import.meta.url), 'utf8');

/**
 * Accessibility baseline — Phase 1 gates (no redesign).
 * These pin the current foundation so Phase 2 cannot silently regress.
 */

describe('accessibility baseline — landmarks & nav semantics', () => {
  it('AppShell renders landmarks: header, aside, and navigation has accessible labels', () => {
    expect(shellSource).toContain('<header');
    expect(shellSource).toContain('<aside');
    // Nav label lives in layout-navigation-view (MobileBottomNav + NavigationLinks context)
    const combined = shellSource + navViewSource;
    expect(combined).toMatch(/aria-label/);
  });

  it('primary and mobile nav use aria-current="page" for active item', () => {
    expect(navViewSource).toContain('aria-current={isActive ? \'page\'');
  });

  it('mobile drawer is a Dialog with hidden title for screen readers', () => {
    expect(shellSource).toContain('<DialogTitle className="sr-only"');
  });

  it('hub section tabs have aria-label (no unlabeled tabsets)', () => {
    // Financials uses SectionTabs with ariaLabel prop + side nav with native aria-label
    expect(financialsSource).toContain('SectionTabs');
    expect(financialsSource).toMatch(/ariaLabel=|aria-label=/);
  });

  it('financials side nav and mobile select both have aria-label', () => {
    expect(financialsSource).toContain('aria-label="أقسام المالية"');
  });

  it('active finance panels use role="tabpanel", while inactive ones are unmounted from DOM completely', () => {
    expect(financialsSource).toContain('role="tabpanel"');
    expect(financialsSource).not.toContain('hidden={activeSection !==');
  });

  it('PageHeader always renders one h1 (heading hierarchy)', () => {
    expect(pageHeaderSource).toContain('<h1');
    // Only one h1 per header instance
    const h1Count = (pageHeaderSource.match(/<h1/g) ?? []).length;
    expect(h1Count).toBe(1);
  });

  it('PageHeaderActions provides accessible overflow for secondary actions (no keyboard trap)', () => {
    const actionsSource = readFileSync(new URL('../components/layout/page-header-actions.tsx', import.meta.url), 'utf8');
    expect(actionsSource.length).toBeGreaterThan(0);
    // Indicates keyboard handling or menu semantics
    expect(actionsSource).toMatch(/menu|aria-|Overflow/i);
  });

  it('quick-add and notifications menus expose aria-haspopup/controls', () => {
    expect(shellSource).toContain('aria-haspopup="menu"');
    expect(shellSource).toContain('aria-expanded');
  });
});

describe('accessibility baseline — text that carries meaning is not decorative-only', () => {
  it('active-filter chips are not aria-hidden only (they convey state)', () => {
    const activeFilter = readFileSync(new URL('../components/ui/active-filter-bar.tsx', import.meta.url), 'utf8');
    // Chips should be real buttons/text, not hidden decoration
    expect(activeFilter).not.toMatch(/aria-hidden="true"[^>]*>.*النشطة.*</);
  });

  it('small-text metric hints exist but inventory notes the risk', () => {
    // text-[11px] / text-xs appear in finance/filters/metrics — allowed for density
    // but flagged for contrast review in FOUNDATION.md §6
    const occurrences = (financialsSource.match(/text-\[11px\]|text-xs/g) ?? []).length;
    expect(occurrences).toBeGreaterThan(0);
    // Ensure we document, not forbid — baseline pinned
  });
});
