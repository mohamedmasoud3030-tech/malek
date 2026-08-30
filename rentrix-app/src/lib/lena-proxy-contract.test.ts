import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LENA_PLATFORM_REWRITE_ORIGIN, LENA_PUBLIC_ENTRY } from './lena-endorsement';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('MALEK /lena reverse-proxy contract', () => {
  const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
    rewrites: Array<{ source: string; destination: string }>;
    headers: Array<{ source: string }>;
  };

  it('rewrites /lena to the Platform origin before the SPA fallback, and never redirects', () => {
    const sources = vercel.rewrites.map((rule) => rule.source);
    const lenaExact = vercel.rewrites.find((rule) => rule.source === '/lena');
    const lenaSplat = vercel.rewrites.find((rule) => rule.source === '/lena/:path*');
    const spa = sources.lastIndexOf('/(.*)');

    expect(lenaExact).toBeTruthy();
    expect(lenaSplat).toBeTruthy();
    expect(lenaExact!.destination).toBe(`${LENA_PLATFORM_REWRITE_ORIGIN}/lena`);
    expect(lenaSplat!.destination).toBe(`${LENA_PLATFORM_REWRITE_ORIGIN}/lena/:path*`);
    expect(lenaExact!.destination.startsWith('http')).toBe(true);
    expect(sources.indexOf('/lena')).toBeLessThan(spa);
    expect(sources.indexOf('/lena/:path*')).toBeLessThan(spa);

    const vercelSource = readFileSync(resolve(root, 'vercel.json'), 'utf8');
    expect(vercelSource).not.toMatch(/"statusCode"\s*:\s*3\d\d/);
  });

  it('keeps frame-ancestors none so /lena cannot be framed either', () => {
    const headerBlob = JSON.stringify(vercel.headers);
    expect(headerBlob).toContain("frame-ancestors 'none'");
    expect(headerBlob).toContain('X-Frame-Options');
  });

  it('publishes a same-origin LENA entry, not support or an internal host', () => {
    expect(LENA_PUBLIC_ENTRY).toBe('/lena/ar?from=malek');
    expect(LENA_PUBLIC_ENTRY).not.toContain('vercel.app');
    expect(LENA_PUBLIC_ENTRY).not.toContain('/support');
    expect(LENA_PUBLIC_ENTRY).not.toContain('/help');
  });
});
