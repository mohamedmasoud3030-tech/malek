import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appLayoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const shell = readFileSync(resolve(appLayoutDir, 'app-shell.tsx'), 'utf8');
const visualWave = readFileSync(resolve(appLayoutDir, '../../styles/malek-pro-visual-wave.css'), 'utf8');

describe('desktop shell declutter contract', () => {
  it('keeps the desktop navigation fixed and expanded with visible labels', () => {
    expect(shell).toContain('<Brand expanded />');
    expect(shell).toContain('<NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} />');
    expect(shell).not.toContain("sidebarCollapsed ? 'w-[4.5rem] overflow-visible'");
    // The fixed, named workspace rail keeps a 14rem footprint and offsets the
    // main content by the same measure (physical right padding in the RTL shell).
    expect(shell).toContain('w-[14rem]');
    expect(shell).toContain('lg:pr-[14rem]');
  });

  it('uses restrained premium chrome instead of the legacy flat/glass split', () => {
    // The malek-pro visual wave pins the shell chrome: clean, opaque,
    // border-based surfaces with no glass/blur stack.
    expect(visualWave).toContain('/* App chrome — clean, opaque, border-based, no glass stack */');
    expect(visualWave).toContain('[data-app-shell] [data-sidebar]');
    expect(visualWave).toContain('[data-app-shell] [data-app-shell-header]');
    expect(visualWave).toContain('background: hsl(var(--card));');
    expect(visualWave).toContain('background: hsl(var(--sidebar));');
    expect(visualWave).toContain('backdrop-filter: none;');
  });
});
