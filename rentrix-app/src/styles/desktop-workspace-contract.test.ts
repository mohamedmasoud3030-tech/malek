import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const desktopStyles = readFileSync(resolve(stylesDir, 'page-polish.css'), 'utf8');
const pageLayout = readFileSync(resolve(stylesDir, '../components/layout/page-layout.tsx'), 'utf8');

describe('desktop workspace contract', () => {
  it('keeps operational pages wider and more spacious on large screens', () => {
    expect(pageLayout).toContain("max-w-[82rem] xl:max-w-[90rem]");
    expect(pageLayout).toContain('lg:space-y-5 lg:pb-10');
  });

  it('keeps desktop registers and work controls dense, calm, and readable', () => {
    expect(desktopStyles).toContain('@media (min-width: 1024px)');
    expect(desktopStyles).toContain('[data-page-layout] [data-filter-bar]');
    expect(desktopStyles).toContain('[data-page-layout] [data-entity-table] thead th');
    expect(desktopStyles).toContain('[data-page-layout] [data-entity-table] tbody td');
    expect(desktopStyles).toContain('[data-page-layout] [data-kpi-card]');
  });

  it('does not apply the desktop contract to phone breakpoints', () => {
    const desktopStart = desktopStyles.indexOf('/* ── Desktop workspace contract');
    const desktopSlice = desktopStyles.slice(desktopStart);
    expect(desktopSlice).toContain('@media (min-width: 1024px)');
  });
});
