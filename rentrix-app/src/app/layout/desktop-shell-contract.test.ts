import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appLayoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const shell = readFileSync(resolve(appLayoutDir, 'app-shell.tsx'), 'utf8');
const pagePolish = readFileSync(resolve(appLayoutDir, '../../styles/page-polish.css'), 'utf8');

describe('desktop shell declutter contract', () => {
  it('keeps the desktop navigation fixed and expanded with visible labels', () => {
    expect(shell).toContain('hidden w-64 overflow-hidden');
    expect(shell).toContain('<Brand expanded />');
    expect(shell).toContain('<NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} />');
    expect(shell).not.toContain("sidebarCollapsed ? 'w-[4.5rem] overflow-visible'");
  });

  it('uses a quiet desktop header and a scrollable permanent navigation', () => {
    expect(pagePolish).toContain('/* ── Desktop shell: fixed, named, and quiet');
    expect(pagePolish).toContain('[data-app-shell] [data-sidebar] > nav');
    expect(pagePolish).toContain('[data-app-shell] [data-app-shell-header]');
    expect(pagePolish).toContain('backdrop-filter: none');
  });
});
