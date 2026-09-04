import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(__dirname, '..', '..');

function read(relativePath: string): string {
  return readFileSync(resolve(appRoot, relativePath), 'utf8');
}

// MALEK public sitemap contract.
// Guards against regressions of the stale sitemap (relative URLs, the removed
// /finance route, and protected app paths that redirect anonymous visitors to
// /login). Only publicly reachable routes belong here.
describe('MALEK public sitemap contract', () => {
  it('uses absolute URLs (required by the sitemap spec)', () => {
    const sitemap = read('public/sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc.startsWith('https://malek-plus.vercel.app/')).toBe(true);
    }
  });

  it('contains only public, authenticated-route-free paths', () => {
    const sitemap = read('public/sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    const paths = locs.map((loc) => new URL(loc).pathname);
    // Protected app surfaces redirect anonymous visitors to /login and must
    // never be listed in the public sitemap.
    expect(paths).not.toContain('/properties');
    expect(paths).not.toContain('/contracts');
    expect(paths).not.toContain('/reports');
    expect(paths).not.toContain('/leads');
    expect(paths).not.toContain('/settings');
    // The legacy /finance route no longer exists (canonical route is /financials).
    expect(paths).not.toContain('/finance');
  });

  it('covers only the current public surfaces', () => {
    const sitemap = read('public/sitemap.xml');
    expect(sitemap).toContain('<loc>https://malek-plus.vercel.app/</loc>');
    expect(sitemap).toContain('<loc>https://malek-plus.vercel.app/privacy</loc>');
    expect(sitemap).toContain('<loc>https://malek-plus.vercel.app/terms</loc>');
    // The /landing marketing URL alias was retired with the route cleanup; /
    // is the single public entry, currently forwarding to the auth flow.
    expect(sitemap).not.toContain('<loc>https://malek-plus.vercel.app/landing</loc>');
  });

  it('publishes an absolute sitemap URL in robots.txt', () => {
    const robots = read('public/robots.txt');
    expect(robots).toContain('Sitemap: https://malek-plus.vercel.app/sitemap.xml');
    expect(robots).not.toMatch(/Sitemap:\s*\/sitemap\.xml\b/);
  });
});
