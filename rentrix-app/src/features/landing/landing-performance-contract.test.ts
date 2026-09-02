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

  it('keeps hermetic E2E fixtures out of the production login route graph', () => {
    const loginRouteSource = readSource('../../routes/_auth.login.tsx');

    expect(loginRouteSource).toContain('import.meta.env.VITE_E2E');
    expect(loginRouteSource).toContain("import('./_auth.login.e2e-fixture')");
    expect(loginRouteSource).not.toContain("@/features/dashboard/dashboard-workspace.e2e-fixture");
    expect(loginRouteSource).not.toContain("@/features/reports/reports-workspace.e2e-fixture");
  });

  it('keeps manual chunking vendor-only so optional vendors stay on their lazy paths', () => {
    const viteConfigSource = readSource('../../../vite.config.ts');

    // Bundle strategy (PR #1691): heavy vendor libraries are split into
    // dedicated `vendor-*` chunks for long-lived browser caching. This is
    // compatible with the landing performance goal as long as the split is
    // strictly vendor-only — Rollup's automatic splitting keeps application
    // modules (and every dynamically imported vendor) on their lazy import
    // path, so nothing optional is forced into the entry chunk.
    //
    // Reviewed exception (initial-payload fix, 2026-08): the Vite preload
    // helper (`vite/preload-helper`) is build runtime, not application code,
    // and is assigned to its own tiny `preload-runtime` chunk. Without that,
    // Rollup merges it into a heavy manual vendor chunk, which forces the
    // whole chunk (vendor-pdf: 835 KiB) into the entry's static graph and
    // modulepreload list even for the unauthenticated login page.
    const start = viteConfigSource.indexOf('manualChunks(id) {');
    expect(start, 'vite.config.ts should keep its vendor split strategy').toBeGreaterThan(-1);
    const body = viteConfigSource.slice(start, viteConfigSource.indexOf('\n        },', start));

    // The node_modules guard must exist and precede every vendor chunk
    // assignment (the preload-helper exception may precede it).
    const guard = 'if (!id.includes("node_modules")) return;';
    const guardAt = body.indexOf(guard);
    expect(guardAt, 'manualChunks must early-return for application modules').toBeGreaterThan(-1);
    const firstAssignment = body.indexOf('return "vendor-');
    expect(guardAt, 'the node_modules guard must come before any vendor chunk assignment').toBeLessThan(firstAssignment);

    // Every manually assigned chunk must be a vendor group or the single
    // reviewed `preload-runtime` build-runtime chunk — application code is
    // never forced into a named chunk.
    const assignedChunks = [...body.matchAll(/return\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(assignedChunks.length, 'the reviewed vendor groups should stay assigned').toBeGreaterThan(0);
    for (const chunk of assignedChunks) {
      const isVendor = chunk.startsWith('vendor-');
      const isReviewedRuntime = chunk === 'preload-runtime';
      expect(
        isVendor || isReviewedRuntime,
        `manual chunk "${chunk}" must be vendor-only or the reviewed preload-runtime chunk`,
      ).toBe(true);
    }
  });

  it('keeps React and shared runtime out of the heavy lazy vendor chunks', () => {
    const viteConfigSource = readSource('../../../vite.config.ts');

    // Regression guard (initial-payload fix): with function-form
    // manualChunks, Rollup's default grouping merges the `react` package into
    // whichever heavy manual vendor chunk references it (vendor-charts). The
    // entry then statically imports that 391 KiB chunk on every page,
    // including the login page. The explicit `vendor-react` pin keeps the
    // chart/pdf stacks lazy while React stays in its own small eager chunk.
    expect(viteConfigSource).toMatch(/return "vendor-react"/);
    expect(viteConfigSource).toContain('node_modules[\\\\/]react[\\\\/]');

    // clsx/tailwind-merge/react-is are shared by the entry shell and by lazy
    // vendor chunks; pinning them to `vendor-runtime` keeps them out of
    // vendor-charts so the chart stack only loads when a chart renders.
    expect(viteConfigSource).toMatch(/return "vendor-runtime"/);
    expect(viteConfigSource).toMatch(/clsx/);

    // The Vite preload helper must never fall back into a heavy vendor chunk.
    expect(viteConfigSource).toMatch(/vite\/preload-helper/);
    expect(viteConfigSource).toMatch(/return "preload-runtime"/);
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
