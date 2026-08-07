// @vitest-environment happy-dom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installProductFonts, productFontsHref } from './product-fonts';

const appRoot = resolve(__dirname, '..', '..');

function read(relativePath: string): string {
  return readFileSync(resolve(appRoot, relativePath), 'utf8');
}

describe('OD-12 — self-hosted product fonts contract', () => {
  it('index.html no longer depends on an external font host', () => {
    const html = read('index.html');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).not.toContain('css2?family=');
  });

  it('the app entry point installs the product fonts loader', () => {
    const entry = read('src/index.tsx');
    expect(entry).toContain("import { loadProductFonts } from '@/lib/product-fonts'");
    expect(entry).toContain('loadProductFonts();');
  });

  it('resolves the fonts stylesheet href relative to the app base', () => {
    expect(productFontsHref('/')).toBe('/fonts/fonts.css');
    expect(productFontsHref('/malik/')).toBe('/malik/fonts/fonts.css');
    expect(productFontsHref('/malik')).toBe('/malik/fonts/fonts.css');
  });

  it('defines Cairo + Sora @font-face rules with font-display: swap', () => {
    const css = read('public/fonts/fonts.css');
    const faces = css.match(/@font-face/g) ?? [];
    // 6 Cairo weights x 2 subsets + 3 Sora weights.
    expect(faces.length).toBe(15);
    expect(css).toContain("font-family: 'Cairo'");
    expect(css).toContain("font-family: 'Sora'");
    expect(css).not.toContain('font-family: \'Sora\';\n  font-style: normal;\n  font-display: auto');
    expect(css.match(/font-display: swap/g)?.length).toBe(15);
    for (const weight of [400, 500, 600, 700, 800, 900]) {
      expect(css, `Cairo ${weight} arabic`).toContain(`./cairo/cairo-arabic-${weight}-normal.woff2`);
      expect(css, `Cairo ${weight} latin`).toContain(`./cairo/cairo-latin-${weight}-normal.woff2`);
    }
    for (const weight of [600, 700, 800]) {
      expect(css, `Sora ${weight}`).toContain(`./sora/sora-latin-${weight}-normal.woff2`);
    }
  });

  it('ships every referenced woff2 file plus the OFL licenses', () => {
    const css = read('public/fonts/fonts.css');
    const urls = [...css.matchAll(/url\(\.\/([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(existsSync(resolve(appRoot, 'public/fonts', url)), `missing woff2 ${url}`).toBe(true);
    }
    // No stray legacy .woff files are needed for the PWA; woff2 is enough.
    expect(readdirSync(resolve(appRoot, 'public/fonts/cairo')).filter((f) => f.endsWith('.woff')).length).toBe(0);
    expect(existsSync(resolve(appRoot, 'public/fonts/OFL-Cairo.txt'))).toBe(true);
    expect(existsSync(resolve(appRoot, 'public/fonts/OFL-Sora.txt'))).toBe(true);

    const pwaConfig = read('vite.config.ts');
    expect(pwaConfig).toContain('woff2');
  });

  it('installs a single deferred stylesheet link into the document head', () => {
    document.head.innerHTML = '';
    installProductFonts(document);
    installProductFonts(document);
    const links = [...document.head.querySelectorAll('link#malek-product-fonts')];
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('rel')).toBe('stylesheet');
    expect(links[0].getAttribute('href')).toMatch(/\/fonts\/fonts\.css$/);
  });
});
