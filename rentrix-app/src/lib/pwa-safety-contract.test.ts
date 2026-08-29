import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(import.meta.dirname, '..', '..');

function read(relativePath: string) {
  return readFileSync(resolve(appRoot, relativePath), 'utf8');
}

describe('PWA safety contract', () => {
  it('uses network-only navigation with a precached offline fallback and never caches navigation HTML at runtime', () => {
    const config = read('vite.config.ts');

    expect(config).toContain('registerType: "prompt"');
    expect(config).toContain('injectRegister: false');
    expect(config).toContain('request.mode === "navigate"');
    expect(config).toContain('handler: "NetworkOnly"');
    expect(config).toContain('precacheFallback: { fallbackURL: "/offline.html" }');
    expect(config).not.toContain('navigateFallback: "/offline.html"');
    expect(config).not.toContain('cacheName: "rentrix-pages"');
    expect(config).not.toContain('handler: "NetworkFirst"');
  });

  it('keeps sensitive Supabase and private data outside runtime cache rules', () => {
    const config = read('vite.config.ts');
    // Bound the scan to the runtimeCaching array itself. Slicing to end of
    // file would also scan unrelated later config (e.g. the manualChunks
    // vendor split, which legitimately names @supabase for bundle chunking).
    const runtimeCachingStart = config.indexOf('runtimeCaching:');
    const runtimeCaching = config.slice(runtimeCachingStart, config.indexOf('],', runtimeCachingStart) + 2);

    expect(runtimeCaching).not.toMatch(/supabase|rest\/v1|storage\/v1|auth\/v1/i);
    expect(runtimeCaching).not.toMatch(/BackgroundSync|queueName/i);
  });

  it('registers updates only in production and leaves activation to an explicit callback', () => {
    const source = read('src/lib/pwa-update.ts');

    expect(source).toContain("import { registerSW } from 'virtual:pwa-register'");
    expect(source).toContain('if (!import.meta.env.PROD || registrationStarted) return;');
    expect(source).toContain('onNeedRefresh()');
    expect(source).toContain('updateServiceWorker(true)');
  });

  it('contains a one-time recovery path for clients trapped behind the previous service worker', () => {
    const config = read('vite.config.ts');
    const recovery = read('public/sw-recovery.js');

    expect(config).toContain('importScripts: ["/sw-recovery.js"]');
    expect(recovery).toContain('self.registration.active');
    expect(recovery).toContain('self.skipWaiting()');
    expect(recovery).toContain('RECOVERY_MARKER');
    expect(recovery).toContain('self.clients.claim()');
  });

  it('ships a rooted Arabic manifest with Apple and maskable icon support', () => {
    const manifest = JSON.parse(read('public/manifest.json')) as {
      start_url: string;
      scope: string;
      lang: string;
      dir: string;
      display: string;
      icons: Array<{ purpose?: string; sizes?: string }>;
    };

    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.lang).toBe('ar');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512')).toBe(true);

    const index = read('index.html');
    expect(index).toContain('apple-mobile-web-app-capable');
    expect(index).toContain('apple-touch-icon');
  });
});
