import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appLayoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const shell = readFileSync(resolve(appLayoutDir, 'app-shell.tsx'), 'utf8');
const pagePolish = readFileSync(resolve(appLayoutDir, '../../styles/page-polish.css'), 'utf8');
const visualWave = readFileSync(resolve(appLayoutDir, '../../styles/malek-pro-visual-wave.css'), 'utf8');

describe('desktop shell declutter contract', () => {
  it('keeps the desktop navigation fixed and expanded with visible labels', () => {
    expect(shell).toContain('<Brand expanded />');
    expect(shell).toContain('<NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} />');
    expect(shell).toContain('data-header-brand-side data-header-wordmark-side>');
    expect(shell).toContain('lg:hidden');
    expect(shell).not.toContain("sidebarCollapsed ? 'w-[4.5rem] overflow-visible'");
    expect(shell).not.toContain('w-[4.5rem]');
    expect(shell).toContain('data-sidebar-collapsed');
    expect(shell).toContain('data-desktop-sidebar-collapse');
    expect(shell).toContain("sharedLabel('collapseMenu')");
    expect(pagePolish).toContain('width: 14rem;');
    expect(pagePolish).toContain('inset-inline-start: 0;');
    expect(pagePolish).toContain('padding-inline-start: 14rem; padding-inline-end: 0;');
    expect(shell).toContain('start-0');
    expect(shell).toContain('lg:ps-[14rem]');
    expect(shell).not.toContain('lg:pr-[14rem]');
    expect(shell).not.toContain('right-0 z-30');
  });

  it('collapses the desktop sidebar by hiding it, never as an unnamed icon rail', () => {
    expect(shell).toContain('data-desktop-sidebar-collapse');
    expect(shell).toContain('data-desktop-sidebar-expand');
    expect(shell).toContain('data-desktop-header-notifications');
    expect(shell).toContain("sidebarCollapsed ? 'hidden' : 'hidden lg:flex lg:flex-col'");
    expect(shell).not.toContain('w-[4.5rem]');
    expect(shell).toContain('<Brand expanded />');
    expect(shell).toContain('expanded sharedLabel={sharedLabel}');
  });

  it('uses restrained opaque chrome instead of the legacy glass split', () => {
    expect(pagePolish).toContain('/* ── Desktop shell: fixed, named, and quiet');
    expect(pagePolish).toContain('[data-app-shell] [data-sidebar] > nav');
    expect(pagePolish).toContain('[data-app-shell] [data-app-shell-header]');
    expect(visualWave).toContain('[data-app-shell] [data-app-shell-header]');
    expect(visualWave).toContain('background: hsl(var(--card));');
    expect(visualWave).toContain('box-shadow: none;');
    expect(visualWave).toContain('backdrop-filter: none;');
    expect(pagePolish).not.toContain('var(--material-chrome)');
    expect(pagePolish).not.toContain('var(--material-blur)');
  });
});
