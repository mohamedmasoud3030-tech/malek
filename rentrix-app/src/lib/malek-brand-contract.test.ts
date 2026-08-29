import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_BRAND_LOCKUP_ASSET,
  APP_BRAND_MARK_ASSET,
  APP_BRAND_NAME,
} from './brand';

const root = resolve(__dirname, '../..');

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('MALEK canonical brand contract', () => {
  it('uses the approved visible English name', () => {
    expect(APP_BRAND_NAME).toBe('MALEK');
  });

  it('routes runtime mark and lockup through canonical assets', () => {
    expect(APP_BRAND_MARK_ASSET).toBe('/malek-mark.svg');
    expect(APP_BRAND_LOCKUP_ASSET).toBe('/malek-lockup.svg');

    const markComponent = read('src/components/brand/malik-mark.tsx');
    const brandComponent = read('src/components/brand/malik-brand.tsx');
    const shellWordmark = read('src/components/brand/malek-wordmark.tsx');
    const shell = read('src/app/layout/app-shell.tsx');
    const navigation = read('src/app/layout/layout-navigation-view.tsx');
    const login = read('src/features/auth/login-page.tsx');

    expect(markComponent).toContain('APP_BRAND_MARK_ASSET');
    expect(brandComponent).toContain('<MalikMark');
    expect(login).toContain('<MalikBrand layout="vertical"');
    expect(login).not.toContain('/icon-malik-192.png');

    // Header/sidebar compatibility imports must resolve to the exact same
    // MalikBrand + MalikMark identity as login, never a hand-built text M.
    expect(shell).toContain('MalekBrandWordmark');
    expect(shellWordmark).toContain('<MalikBrand');
    expect(shellWordmark).not.toContain('data-brand-m');
    expect(shellWordmark).not.toContain('data-brand-name');

    // Sidebar/mobile-menu use the same centered lockup at the top of navigation.
    expect(shellWordmark).toContain("size === 'sidebar' && 'w-full justify-center'");
    expect(navigation).toContain('data-mobile-nav-brand');
    expect(navigation).toContain('<MalekBrandWordmark size="sidebar" />');
    expect(navigation).toContain('sticky top-0');
  });

  it('stores MALEK inside the actual lockup image', () => {
    const lockup = read('public/malek-lockup.svg');
    // #1384 standardized the lockup asset onto the approved angular MALEK mark.
    expect(lockup).toContain('<title id="malek-mark-title">MALEK</title>');
    expect(lockup).not.toContain('>MALIK</text>');
  });

  it('publishes only canonical MALEK manifest icons', () => {
    const manifest = JSON.parse(read('public/manifest.json')) as {
      name: string;
      short_name: string;
      icons: Array<{ src: string }>;
    };
    expect(manifest.name).toContain('MALEK');
    expect(manifest.short_name).toBe('MALEK');
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/malek-icon-192.png',
      '/malek-icon-512.png',
      '/malek-maskable-192.png',
      '/malek-maskable-512.png',
      '/malek-mark.svg',
      '/malek-maskable.svg',
    ]);
  });

  it('uses the corrected email placeholder', () => {
    expect(read('src/features/auth/login-page.tsx')).toContain('placeholder="name@malek.com"');
  });
});
