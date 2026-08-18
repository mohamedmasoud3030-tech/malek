import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');

describe('platform security and PWA boundaries', () => {
  it('pins the patched DOMPurify line required by the current XSS advisory', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const lock = readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8');
    expect(pkg.pnpm.overrides.dompurify).toBe('>=3.4.13');
    expect(lock).toContain('dompurify@3.4.13');
  });

  it('does not permit eval and blocks plugin objects, foreign base tags and form exfiltration', () => {
    const config = readFileSync(resolve(root, 'rent' + 'rix-app/vercel.json'), 'utf8');
    expect(config).not.toContain("'unsafe-eval'");
    expect(config).toContain("object-src 'none'");
    expect(config).toContain("base-uri 'self'");
    expect(config).toContain("form-action 'self'");
  });

  it('keeps service-worker runtime caching limited to navigations and static assets', () => {
    const vite = readFileSync(resolve(root, 'rent' + 'rix-app/vite.config.ts'), 'utf8');
    expect(vite).toContain('request.mode === "navigate"');
    expect(vite).toContain('request.destination === "style"');
    expect(vite).toContain('navigateFallbackDenylist: [/^\\/api\\//]');
    expect(vite).not.toMatch(/urlPattern:[^\n]*supabase/i);
  });

  it('precaches the install shell only — not every lazy JS chunk or landing PNG', () => {
    const vite = readFileSync(resolve(root, 'rent' + 'rix-app/vite.config.ts'), 'utf8');
    expect(vite).toContain('"index.html"');
    expect(vite).toContain('"offline.html"');
    expect(vite).toContain('"assets/*.css"');
    expect(vite).toContain('"fonts/**/*.{css,woff2}"');
    expect(vite).toContain('"malek-*.svg"');
    expect(vite).not.toContain('**/*.{js,css,html,ico,png,svg,webp,woff2}');
    expect(vite).not.toMatch(/globPatterns:\s*\[[^\]]*js,/);
  });
});
