import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Desktop workspace contract.
 *
 * This used to be asserted against page-polish.css. That stylesheet is retired:
 * the desktop contract is now split along ownership lines, which is exactly the
 * point of the current architecture —
 *   · ux-foundation.css owns desktop GEOMETRY (measures, sticky/table sizing,
 *     sidebar rail, header rhythm) under "Desktop workspace geometry".
 *   · malek-pro-visual-wave.css owns desktop VISUAL QUIETING (surface ink,
 *     shadows, radius, type) under "Desktop visual quieting".
 * A rule appearing in the wrong half is a real regression, so each assertion
 * names the file that must carry it.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const ux = readFileSync(resolve(stylesDir, 'ux-foundation.css'), 'utf8');
const wave = readFileSync(resolve(stylesDir, 'malek-pro-visual-wave.css'), 'utf8');
const pageLayout = readFileSync(resolve(stylesDir, '../components/layout/page-layout.tsx'), 'utf8');

/** The `@media` block that follows `marker`, brace-balanced. */
function blockAfter(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const media = source.indexOf('@media', start);
  if (media < 0) return '';
  const open = source.indexOf('{', media);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(media, i + 1);
  }
  return source.slice(media);
}

const desktopGeometry = blockAfter(ux, '/* ── Desktop workspace geometry');
const desktopVisual = blockAfter(wave, '/* ── Desktop visual quieting');

describe('desktop workspace contract', () => {
  it('keeps operational pages wider and more spacious on large screens', () => {
    expect(pageLayout).toContain("max-w-[82rem] xl:max-w-[90rem]");
    expect(pageLayout).toContain('lg:space-y-5 lg:pb-10');
  });

  it('keeps desktop registers and work controls dense, calm, and readable', () => {
    for (const selector of [
      '[data-page-layout] [data-filter-bar]',
      '[data-page-layout] [data-entity-table] thead th',
      '[data-page-layout] [data-entity-table] tbody td',
      '[data-page-layout] [data-kpi-card]',
    ]) {
      expect(desktopGeometry, `structural owner must define ${selector}`).toContain(selector);
    }
    expect(desktopVisual).toContain('[data-page-layout] [data-register-metric]');
    expect(desktopVisual).toContain('[data-page-layout] [data-kpi-card]');
    expect(desktopGeometry + desktopVisual).not.toContain('[data-list-controls]');
  });

  it('measures the desktop workspace instead of restyling it, and vice versa', () => {
    // Declarations only — the query itself legitimately mentions min-width.
    const declarations = (block: string) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^[a-z-]+\s*:/.test(line));

    // Geometry half paints nothing; the visual half sets no measures.
    expect(declarations(desktopGeometry).some((line) => /^(box-shadow|border-color|background|color)\s*:/.test(line))).toBe(false);
    expect(declarations(desktopVisual).some((line) => /^(padding|margin|width|height|min-height|inset)/.test(line))).toBe(false);
    expect(declarations(desktopGeometry).length).toBeGreaterThan(0);
    expect(declarations(desktopVisual).length).toBeGreaterThan(0);
  });

  it('does not apply the desktop contract to phone breakpoints', () => {
    expect(desktopGeometry).toContain('@media (min-width: 1024px)');
    expect(desktopGeometry).not.toContain('@media (max-width');
    expect(desktopVisual).toContain('@media (min-width: 1024px)');
    expect(desktopVisual).not.toContain('@media (max-width');
  });

  it('covers 1366, 1440, and 1920 desktop widths with the same 1024px contract', () => {
    const combined = ux + wave;
    expect(combined).toContain('@media (min-width: 1024px)');
    for (const breakpoint of [1366, 1440, 1920]) {
      expect(combined, `no bespoke ${breakpoint}px breakpoint`).not.toContain(`@media (min-width: ${breakpoint}px)`);
      expect(breakpoint).toBeGreaterThanOrEqual(1024);
    }
  });

  it('does not resurrect the retired authority file to hold this contract', () => {
    expect(readFileSync(resolve(stylesDir, 'globals.css'), 'utf8')).not.toMatch(
      /@import '\.\/page-polish\.css';/,
    );
  });
});
