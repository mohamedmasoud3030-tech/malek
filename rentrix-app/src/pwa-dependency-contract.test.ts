import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageManifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { dependencies?: Record<string, string> };
const lockfile = readFileSync(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8');

describe('PWA registration dependency contract', () => {
  it('declares workbox-window directly for vite-plugin-pwa virtual registration', () => {
    expect(packageManifest.dependencies?.['workbox-window']).toBe('^7.4.1');
    expect(lockfile).toContain('      workbox-window:\n        specifier: ^7.4.1\n        version: 7.4.1');
  });
});
