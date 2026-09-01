import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Desktop shell declutter contract, split by owner:
 *   · ux-foundation.css — the fixed 14rem rail, its content offset, nav padding.
 *   · malek-pro-visual-wave.css — the header's opaque, shadow-free, blur-free
 *     paint (the "quiet chrome" decision).
 * The retired page-polish.css used to hold both halves, which is why desktop
 * chrome kept winning ties against MALEK. Its glass variables must not come
 * back in either file.
 */

const appLayoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const shell = readFileSync(resolve(appLayoutDir, 'app-shell.tsx'), 'utf8');
const ux = readFileSync(resolve(appLayoutDir, '../../styles/ux-foundation.css'), 'utf8');
const visualWave = readFileSync(resolve(appLayoutDir, '../../styles/malek-pro-visual-wave.css'), 'utf8');

describe('desktop shell declutter contract', () => {
  it('keeps the desktop navigation fixed and expanded with visible labels', () => {
    expect(shell).toContain('<Brand expanded />');
    expect(shell).toContain('<NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} />');
    expect(shell).toContain('data-header-brand-side data-header-wordmark-side>');
    expect(shell).toContain('lg:hidden');
    expect(shell).not.toContain("sidebarCollapsed ? 'w-[4.5rem] overflow-visible'");
    expect(ux).toContain('width: 14rem;');
    expect(ux).toContain('inset-inline-start: 0;');
    expect(ux).toContain('padding-inline-start: 14rem;');
    expect(ux).toContain('padding-inline-end: 0;');
    expect(shell).toContain('start-0');
    expect(shell).toContain('lg:ps-[14rem]');
    expect(shell).not.toContain('lg:pr-[14rem]');
    expect(shell).not.toContain('right-0 z-30');
  });

  it('uses restrained opaque chrome instead of the legacy glass split', () => {
    expect(ux).toContain('[data-app-shell] [data-sidebar] > nav');
    expect(visualWave).toContain('[data-app-shell] [data-app-shell-header]');
    expect(visualWave).toContain('background: hsl(var(--card));');
    expect(visualWave).toContain('box-shadow: none;');
    expect(visualWave).toContain('backdrop-filter: none;');
    for (const [name, source] of [['ux-foundation.css', ux], ['malek-pro-visual-wave.css', visualWave]] as const) {
      expect(source, `${name} must not revive the glass tokens`).not.toContain('var(--material-chrome)');
      expect(source, `${name} must not revive the glass tokens`).not.toContain('var(--material-blur)');
    }
  });

  it('leaves the header height to the token instead of hard-coding a second value', () => {
    // The shell sizes its own header row from --app-header-height, so no style
    // sheet may pin a competing min-height on the header element.
    expect(ux).toContain('--app-header-height: 3rem;');
    expect(ux).toContain('--app-header-height: 3.5rem;');
    expect(ux).not.toMatch(/\[data-app-shell-header\]\s*\{[^}]*min-height/);
    expect(visualWave).not.toMatch(/\[data-app-shell-header\]\s*\{[^}]*min-height/);
  });
});
