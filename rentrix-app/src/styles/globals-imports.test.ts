import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../index.tsx', import.meta.url), 'utf8');

/**
 * Cascade ownership contract.
 *
 * The MALEK runtime bug was not "the wrong colors were written" — it was
 * ownership: an unlayered legacy file (page-polish.css) was imported AFTER the
 * visual wave, so on every equal-specificity tie the legacy file won and the
 * new system silently lost. These guards keep that from being reintroduced.
 */
describe('global stylesheet imports', () => {
  it('keeps each CSS import as a real line so PostCSS can parse the entrypoint', () => {
    expect(source).not.toContain('\\n@import');
  });

  it('loads styles in ownership order: foundation, then density, then the visual wave', () => {
    const order = [
      "./tokens.css",
      "./ux-foundation.css",
      "./design-system-foundation.css",
      "./app-density-contract.css",
      "./malek-pro-visual-wave.css",
    ].map((spec) => source.indexOf(`@import '${spec}';`));

    for (const index of order) {
      expect(index).toBeGreaterThan(-1);
    }
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('ends the import list with the MALEK visual authority', () => {
    const imports = [...source.matchAll(/@import '([^']+)';/g)].map((m) => m[1]);
    expect(imports.at(-1)).toBe('./malek-pro-visual-wave.css');
  });

  it('does not revive the retired legacy polish stylesheet', () => {
    // The banner may name it to record why it is gone; no import may load it.
    expect([...source.matchAll(/@import '([^']+)';/g)].map((m) => m[1])).not.toContain(
      './page-polish.css',
    );
    expect(existsSync(new URL('./page-polish.css', import.meta.url))).toBe(false);
    expect(entrySource).not.toContain('page-polish');
  });

  it('loads the production style stack once through globals.css', () => {
    const globalStyleImports = entrySource.match(/import ['"]@\/styles\//g) ?? [];

    expect(globalStyleImports).toHaveLength(1);
    expect(entrySource).toContain("import '@/styles/globals.css';");
    expect(entrySource).not.toContain("import '@/styles/ux-foundation.css';");
  });
});
