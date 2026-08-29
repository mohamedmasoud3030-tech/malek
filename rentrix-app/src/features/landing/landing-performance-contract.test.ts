import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('public landing performance contract', () => {
  it('keeps authenticated providers and Supabase out of the public entry path', () => {
    const appSource = readSource('../../App.tsx');
    const routeTreeSource = readSource('../../app/router/route-tree.ts');

    expect(appSource).not.toContain('AppProviders');
    expect(routeTreeSource).not.toMatch(/^import .*['"]@\/lib\/supabase['"];?$/m);
    expect(routeTreeSource).toContain("await import('@/lib/supabase')");
    expect(routeTreeSource).toContain("lazyRouteComponent(() => import('@/routes/_protected')");
  });

  it('keeps manual chunking vendor-only so optional vendors stay on their lazy paths', () => {
    const viteConfigSource = readSource('../../../vite.config.ts');

    // Bundle strategy (PR #1691): heavy vendor libraries are split into
    // dedicated `vendor-*` chunks for long-lived browser caching. This is
    // compatible with the landing performance goal as long as the split is
    // strictly vendor-only — Rollup's automatic splitting keeps application
    // modules (and every dynamically imported vendor) on their lazy import
    // path, so nothing optional is forced into the entry chunk.
    const start = viteConfigSource.indexOf('manualChunks(id) {');
    expect(start, 'vite.config.ts should keep its vendor split strategy').toBeGreaterThan(-1);
    const body = viteConfigSource.slice(start, viteConfigSource.indexOf('\n        },', start));

    // The node_modules guard must exist and precede every chunk assignment.
    const guard = 'if (!id.includes("node_modules")) return;';
    const guardAt = body.indexOf(guard);
    expect(guardAt, 'manualChunks must early-return for application modules').toBeGreaterThan(-1);
    const firstAssignment = body.indexOf('return "vendor-');
    expect(guardAt, 'the node_modules guard must come before any chunk assignment').toBeLessThan(firstAssignment);

    // Every manually assigned chunk must be a vendor group — application
    // code is never forced into a named chunk.
    const assignedChunks = [...body.matchAll(/return\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(assignedChunks.length, 'the reviewed vendor groups should stay assigned').toBeGreaterThan(0);
    for (const chunk of assignedChunks) {
      expect(chunk.startsWith('vendor-'), `manual chunk "${chunk}" must be vendor-only`).toBe(true);
    }
  });

  it('keeps first-view artwork compact and the demo video user-initiated', () => {
    const publicRoot = new URL('../../../public/', import.meta.url);
    const heroBytes = statSync(new URL('landing/dashboard.webp', publicRoot)).size;
    const showcaseSource = readSource('./components/Showcase.tsx');

    expect(heroBytes).toBeLessThan(60_000);
    expect(showcaseSource).toContain('{videoOpen ? (');
  });

  it('keeps the landing brand mark lightweight and free of legacy icon assets', () => {
    const navBarSource = readSource('./components/NavBar.tsx');
    const footerSource = readSource('./components/Footer.tsx');
    const publicRoot = new URL('../../../public/', import.meta.url);
    const markBytes = statSync(new URL('malek-mark.svg', publicRoot)).size;

    expect(markBytes).toBeLessThan(2_000);
    expect(navBarSource).toContain('MalikBrand');
    expect(footerSource).toContain('MalikBrand');
    expect(navBarSource).not.toContain('icon-rentrix');
    expect(footerSource).not.toContain('icon-rentrix');
  });

  it('loads the self-hosted brand fonts after the initial document load', () => {
    const globalStyles = readSource('../../styles/globals.css');
    const indexHtml = readSource('../../../index.html');
    const entry = readSource('../../index.tsx');
    const productFonts = readSource('../../lib/product-fonts.ts');

    expect(globalStyles).not.toContain('fonts.googleapis.com');
    expect(indexHtml).not.toContain('fonts.googleapis.com');
    expect(indexHtml).not.toContain('fonts.gstatic.com');
    // Deferred on window load, injected by the typed app entry (OD-12).
    expect(entry).toContain('loadProductFonts();');
    expect(productFonts).toContain("win.addEventListener('load', install, { once: true })");
  });
});
