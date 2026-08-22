import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('UI mobile architecture reset — shared foundation', () => {
  it('keeps one shared table that scrolls horizontally instead of a second mobile card system', () => {
    const table = read('../components/ui/entity-table.tsx');
    expect(table).toContain('data-compact-responsive-table');
    expect(table).toContain('mobile-scroll-x');
    expect(table).toContain('if (totalPages <= 1) return null');
  });

  it('hides native finance <select> and uses product navigation', () => {
    const finance = read('./financials/financials-page.tsx');
    expect(finance).toContain('WorkspaceNav');
    expect(finance).toContain('data-finance-mobile-nav');
    expect(finance).not.toMatch(/<select[\s\S]*أقسام المالية/);
  });

  it('places notifications where AI used to sit and raises AI to the far left of the dock', () => {
    const dock = read('../app/layout/layout-navigation-view.tsx');
    const notifications = dock.indexOf('data-mobile-dock-notifications');
    const ai = dock.indexOf('data-mobile-dock-ai');
    expect(notifications).toBeGreaterThan(0);
    expect(ai).toBeGreaterThan(notifications);
    expect(dock).toContain('-translate-y-1.5');
    expect(dock).toContain('pb-[calc(0.75rem+env(safe-area-inset-bottom');
  });

  it('keeps empty states compact and register summaries shared', () => {
    const empty = read('../components/empty-state.tsx');
    const summary = read('../components/layout/register-summary.tsx');
    expect(empty).toContain('min-h-28');
    expect(empty).not.toContain('min-h-56');
    expect(summary).toContain('data-register-metric-strip');
    expect(summary).toContain('hideWhenEmpty');
  });
});
