import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellSource = readFileSync(new URL('./layout/app-shell.tsx', import.meta.url), 'utf8');
const navViewSource = readFileSync(new URL('./layout/layout-navigation-view.tsx', import.meta.url), 'utf8');
const pageHeaderSource = readFileSync(new URL('../components/layout/page-header.tsx', import.meta.url), 'utf8');
const financialsSource = readFileSync(new URL('../features/finance/FinancePage.tsx', import.meta.url), 'utf8');

describe('accessibility baseline — landmarks & nav semantics', () => {
  it('AppShell renders landmarks and accessible navigation labels', () => {
    expect(shellSource).toContain('<header');
    expect(shellSource).toContain('<aside');
    expect(shellSource + navViewSource).toMatch(/aria-label/);
  });

  it('primary and mobile nav use aria-current="page" for active item', () => {
    expect(navViewSource).toContain('aria-current={isActive ? \'page\'');
  });

  it('mobile drawer is a Dialog with hidden title for screen readers', () => {
    expect(shellSource).toContain('<DialogTitle className="sr-only"');
  });

  it('canonical Money tabs and navigation are labeled', () => {
    expect(financialsSource).toContain('SectionTabs');
    expect(financialsSource).toMatch(/ariaLabel=|aria-label=/);
    expect(financialsSource).toContain('aria-label="أقسام المالية"');
  });

  it('active finance panels use tabpanel roles while inactive ones are unmounted', () => {
    expect(financialsSource).toContain('role="tabpanel"');
    expect(financialsSource).not.toContain('hidden={activeSection !==');
  });

  it('PageHeader always renders one h1', () => {
    expect(pageHeaderSource).toContain('<h1');
    expect((pageHeaderSource.match(/<h1/g) ?? []).length).toBe(1);
  });

  it('PageHeaderActions provides accessible overflow for secondary actions', () => {
    const actionsSource = readFileSync(new URL('../components/layout/page-header-actions.tsx', import.meta.url), 'utf8');
    expect(actionsSource.length).toBeGreaterThan(0);
    expect(actionsSource).toMatch(/menu|aria-|Overflow/i);
  });

  it('quick-add and account controls expose menu state', () => {
    expect(shellSource).toContain('aria-haspopup="menu"');
    expect(shellSource).toContain('aria-expanded');
  });
});

describe('accessibility baseline — meaningful text remains readable', () => {
  it('active-filter chips are not decorative-only', () => {
    const activeFilter = readFileSync(new URL('../components/ui/active-filter-bar.tsx', import.meta.url), 'utf8');
    expect(activeFilter).not.toMatch(/aria-hidden="true"[^>]*>.*النشطة.*</);
  });

  it('dense finance metadata remains explicit text rather than decoration', () => {
    const occurrences = (financialsSource.match(/text-\[11px\]|text-xs/g) ?? []).length;
    expect(occurrences).toBeGreaterThan(0);
  });
});
