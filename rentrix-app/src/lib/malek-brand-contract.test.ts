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
    const login = read('src/features/auth/login-page.tsx');
    expect(markComponent).toContain('APP_BRAND_MARK_ASSET');
    expect(login).toContain('APP_BRAND_LOCKUP_ASSET');
    expect(login).not.toContain('/icon-malik-192.png');
  });

  it('stores MALEK inside the actual lockup image', () => {
    const lockup = read('public/malek-lockup.svg');
    expect(lockup).toContain('>MALEK</text>');
    expect(lockup).toContain('id="malek-lockup-title">MALEK</title>');
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
      '/malek-lockup.svg',
      '/malek-maskable.svg',
    ]);
  });

  it('uses the corrected email placeholder', () => {
    expect(read('src/features/auth/login-page.tsx')).toContain('placeholder="name@malek.com"');
  });
});
