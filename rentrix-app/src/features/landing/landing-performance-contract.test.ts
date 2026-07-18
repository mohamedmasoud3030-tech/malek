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
    const iconBytes = statSync(new URL('icon-rentrix-192.png', publicRoot)).size;
    const showcaseSource = readSource('./components/Showcase.tsx');

    expect(heroBytes).toBeLessThan(60_000);
    expect(iconBytes).toBeLessThan(25_000);
    expect(showcaseSource).toContain('{videoOpen ? (');
  });

  it('loads the remote Cairo stylesheet after the initial document load', () => {
    const globalStyles = readSource('../../styles/globals.css');
    const indexHtml = readSource('../../../index.html');

    expect(globalStyles).not.toContain('fonts.googleapis.com');
    expect(indexHtml).toContain("window.addEventListener('load'");
  });
});
