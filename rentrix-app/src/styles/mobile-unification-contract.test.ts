import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('mobile UI unification contract', () => {
  it('loads one mobile reconciliation layer inside the canonical global stylesheet stack', () => {
    const globals = read('src/styles/globals.css');
    const uxIndex = globals.indexOf("@import './ux-foundation.css';");
    const mobileIndex = globals.indexOf("@import './mobile-unification.css';");
    const designIndex = globals.indexOf("@import './design-system-foundation.css';");

    expect(uxIndex).toBeGreaterThan(-1);
    expect(mobileIndex).toBeGreaterThan(uxIndex);
    expect(designIndex).toBeGreaterThan(mobileIndex);
  });

  it('restores quiet page and filter chrome on phones despite later visual paint rules', () => {
    const mobileCss = read('src/styles/mobile-unification.css');
    const pageHeader = read('src/components/layout/page-header.tsx');
    const filterBar = read('src/components/ui/filter-bar.tsx');

    expect(pageHeader).toContain('document chrome');
    expect(filterBar).toContain('quiet edge-to-edge strip');
    expect(mobileCss).toContain('html [data-malek-surface] [data-page-header]');
    expect(mobileCss).toContain("html [data-operational-route='true'] [data-malek-surface] [data-filter-bar]");
    expect(mobileCss).toContain('background: transparent;');
    expect(mobileCss).toContain('box-shadow: none;');
  });

  it('keeps EntityTable registers on the same two-column phone density as shared card grids', () => {
    const mobileCss = read('src/styles/mobile-unification.css');
    const responsiveGrid = read('src/components/ui/responsive-card-grid.tsx');

    expect(mobileCss).toContain('[data-entity-table-mobile-list]');
    expect(mobileCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(responsiveGrid).toContain("'grid min-w-0 grid-cols-2'");
  });

  it('removes mobile-only presentation drift from finance filters and maintenance quick chips', () => {
    const mobileCss = read('src/styles/mobile-unification.css');

    expect(mobileCss).toContain('[data-finance-filter-bar]');
    expect(mobileCss).toContain('[data-maintenance-attention-chip]');
    expect(mobileCss).toContain('display: none;');
  });

  it('preserves one compact phone toolbar and 44px action floor', () => {
    const filterBar = read('src/components/ui/filter-bar.tsx');
    const mobileCss = read('src/styles/mobile-unification.css');

    expect(filterBar).toContain('data-filter-view-mode');
    expect(filterBar).toContain('data-unified-filter-sheet');
    expect(filterBar).toContain('md:hidden');
    expect(mobileCss).toContain('[data-entity-table-view-toggle] button');
    expect(mobileCss).toContain('font-size: 0;');
    expect(mobileCss).toContain('min-height: 44px;');
    expect(mobileCss).toContain('min-width: 44px;');
  });
});
