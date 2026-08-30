import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isForbiddenLenaDestination,
  lenaHousePublicEntry,
  resolveLenaHouseOrigin,
} from './lena-endorsement';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('MALEK parent-brand contract — independent LENA site', () => {
  const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
    rewrites: Array<{ source: string; destination: string }>;
    headers: Array<{ source: string }>;
  };
  const endorsementSource = readFileSync(resolve(root, 'src/lib/lena-endorsement.ts'), 'utf8');
  const vercelSource = readFileSync(resolve(root, 'vercel.json'), 'utf8');

  it('does not reverse-proxy /lena onto Platform, and never redirects there', () => {
    const sources = vercel.rewrites.map((rule) => rule.source);
    expect(sources).not.toContain('/lena');
    expect(sources).not.toContain('/lena/:path*');
    expect(vercel.rewrites.some((rule) => rule.source.includes('/lena'))).toBe(false);
    expect(vercel.rewrites.some((rule) => /lena-digital-house|jiwdah-website/i.test(rule.destination))).toBe(false);
    expect(sources.filter((source) => source === '/(.*)')).toEqual(['/(.*)']);
    expect(vercelSource).not.toMatch(/"statusCode"\s*:\s*3\d\d/);
  });

  it('keeps frame-ancestors none so LENA cannot be iframed from MALEK', () => {
    const headerBlob = JSON.stringify(vercel.headers);
    expect(headerBlob).toContain("frame-ancestors 'none'");
    expect(headerBlob).toContain('X-Frame-Options');
  });

  it('does not ship a same-origin /lena fallback page', () => {
    expect(existsSync(resolve(root, 'public/lena-unavailable.html'))).toBe(false);
  });

  it('does not hardcode a technical Vercel host, GitHub, or a MALEK /lena path', () => {
    expect(endorsementSource).not.toMatch(/https:\/\/[a-z0-9.-]+\.vercel\.app/i);
    expect(endorsementSource).not.toMatch(/https:\/\/github\.com/i);
    expect(endorsementSource).not.toMatch(/LENA_PUBLIC_ENTRY\s*=\s*['"`]\/lena/);
    expect(endorsementSource).not.toMatch(/['"`]\/lena\/ar/);
    expect(endorsementSource).toContain('VITE_LENA_HOUSE_ORIGIN');
  });

  it('builds an absolute company URL from the independent origin', () => {
    expect(lenaHousePublicEntry('https://lena.example', 'ar')).toBe('https://lena.example/ar?from=malek');
    expect(lenaHousePublicEntry('https://lena.example/', 'en')).toBe('https://lena.example/en?from=malek');
    expect(resolveLenaHouseOrigin('https://lena.example/')).toBe('https://lena.example');
  });

  it('rejects support, GitHub, and same-origin /lena destinations', () => {
    expect(isForbiddenLenaDestination('https://github.com/mohamedmasoud3030-tech/platform')).toBe(true);
    expect(isForbiddenLenaDestination('/lena/ar?from=malek')).toBe(true);
    expect(isForbiddenLenaDestination('https://malek.example/lena')).toBe(true);
    expect(isForbiddenLenaDestination('https://lena.example/support')).toBe(true);
    expect(isForbiddenLenaDestination('https://lena.example/help')).toBe(true);
    expect(lenaHousePublicEntry('https://github.com/acme', 'ar')).toBe('');
    expect(lenaHousePublicEntry('/lena', 'ar')).toBe('');
    expect(lenaHousePublicEntry('', 'ar')).toBe('');
    expect(lenaHousePublicEntry('http://insecure.example', 'ar')).toBe('');
  });
});
