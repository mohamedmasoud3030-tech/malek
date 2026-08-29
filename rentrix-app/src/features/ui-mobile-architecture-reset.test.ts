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

  it('uses direct product navigation for the canonical FinancePage', () => {
    const finance = read('./finance/FinancePage.tsx');
    expect(finance).toContain('SectionTabs');
    expect(finance).toContain('data-finance-primary-nav');
    expect(finance).not.toMatch(/<select[\s\S]*أقسام المالية/);
  });

  it('keeps Menu, Search and utilities in the current compact dock order', () => {
    const dock = read('../app/layout/layout-navigation-view.tsx');
    const menu = dock.indexOf('data-mobile-dock-menu');
    const search = dock.indexOf('data-mobile-dock-search');
    const quickAdd = dock.indexOf('data-mobile-dock-quick-add');
    const notifications = dock.indexOf('data-mobile-dock-notifications');
    const ai = dock.indexOf('data-mobile-dock-ai');
    expect(menu).toBeGreaterThan(0);
    expect(search).toBeGreaterThan(menu);
    expect(quickAdd).toBeGreaterThan(search);
    expect(notifications).toBeGreaterThan(quickAdd);
    expect(ai).toBeGreaterThan(notifications);
    expect(dock).toContain('pb-[calc(0.75rem+env(safe-area-inset-bottom');
  });

  it('keeps empty states compact and register summaries shared', () => {
    const empty = read('../components/ui/state-surfaces.tsx');
    const summary = read('../components/layout/register-summary.tsx');
    expect(empty).toContain('min-h-28');
    expect(empty).not.toContain('min-h-56');
    expect(summary).toContain('data-register-metric-strip');
    expect(summary).toContain('hideWhenEmpty');
  });
});
