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

  it('does not force optional application vendors into manual entry chunks', () => {
    const viteConfigSource = readSource('../../../vite.config.ts');

    expect(viteConfigSource).not.toContain('manualChunks');
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
    const markBytes = statSync(new URL('malik-mark.svg', publicRoot)).size;

    expect(markBytes).toBeLessThan(2_000);
    expect(navBarSource).toContain('MalikBrand');
    expect(footerSource).toContain('MalikBrand');
    expect(navBarSource).not.toContain('icon-rentrix');
    expect(footerSource).not.toContain('icon-rentrix');
  });

  it('loads the remote brand fonts after the initial document load', () => {
    const globalStyles = readSource('../../styles/globals.css');
    const indexHtml = readSource('../../../index.html');

    expect(globalStyles).not.toContain('fonts.googleapis.com');
    expect(indexHtml).toContain("window.addEventListener('load'");
  });
});
