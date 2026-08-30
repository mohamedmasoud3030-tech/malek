import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('UI mobile architecture reset — shared foundation', () => {
  it('keeps one shared register foundation that becomes phone row cards instead of a second data architecture', () => {
    const table = read('../components/ui/entity-table.tsx');
    expect(table).toContain('data-compact-responsive-table');
    expect(table).toContain('data-entity-table-mobile-list');
    expect(table).toContain('mobile-scroll-x');
    expect(table).toContain("viewportMode === 'mobile'");
    expect(table).toContain('if (totalPages <= 1) return null');
  });

  it('uses direct product navigation for the canonical FinancePage', () => {
    const finance = read('./finance/FinancePage.tsx');
    expect(finance).toContain('SectionTabs');
    expect(finance).toContain('data-finance-primary-nav');
    expect(finance).not.toMatch(/<select[\s\S]*أقسام المالية/);
  });

  it('keeps Search and Quick Add in the phone header and a minimal lower dock', () => {
    const chrome = read('../app/layout/layout-navigation-view.tsx');
    const quickAdd = chrome.indexOf('data-header-quick-add');
    const search = chrome.indexOf('data-header-phone-search');
    const menu = chrome.indexOf('data-mobile-dock-menu');
    const notifications = chrome.indexOf('data-mobile-dock-notifications');
    const ai = chrome.indexOf('data-mobile-dock-ai');
    expect(quickAdd).toBeGreaterThan(0);
    expect(search).toBeGreaterThan(quickAdd);
    expect(menu).toBeGreaterThan(search);
    expect(notifications).toBeGreaterThan(menu);
    expect(ai).toBeGreaterThan(notifications);
    expect(chrome).not.toContain('data-mobile-dock-search');
    expect(chrome).not.toContain('data-mobile-dock-quick-add');
    expect(chrome).toContain('pb-[calc(1.15rem+env(safe-area-inset-bottom');
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
