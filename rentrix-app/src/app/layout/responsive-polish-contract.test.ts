import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(relative: string) {
  return readFileSync(resolve(root, relative), 'utf8');
}

describe('responsive polish contract', () => {
  it('offsets the desktop sidebar with logical properties so RTL and LTR share one rail', () => {
    const shell = read('src/app/layout/app-shell.tsx');
    expect(shell).toContain('inset-y-0 start-0');
    expect(shell).toContain('border-e');
    expect(shell).toContain('lg:ps-[14rem]');
    expect(shell).not.toContain('lg:pr-[14rem]');
    expect(shell).not.toMatch(/fixed inset-y-0 right-0/);
  });

  it('lets page titles wrap on narrow viewports instead of clipping the actions rail', () => {
    const header = read('src/components/layout/page-header.tsx');
    expect(header).toContain('flex-wrap');
    expect(header).toContain('[overflow-wrap:anywhere]');
    expect(header).toContain('basis-full');
  });

  it('clears the phone dock with the shared token instead of a hard-coded bottom offset', () => {
    const receipt = read('src/features/financials/receipts/receipt-detail-page.tsx');
    expect(receipt).toContain('bottom-[var(--mobile-dock-clearance,5.25rem)]');
    expect(receipt).not.toContain('bottom-20 left-4 right-4');
  });

  it('pins property detail nav under the live header height token', () => {
    const property = read('src/features/properties/property-detail-page.tsx');
    expect(property).toContain('top-[calc(var(--app-header-height)+0.75rem)]');
    expect(property).not.toContain('top-[4.5rem]');
  });

  it('does not add a second desktop page gutter on top of #main-content', () => {
    const polish = read('src/styles/page-polish.css');
    expect(polish).not.toContain('[data-page-layout] > div { padding-inline:');
  });
});
