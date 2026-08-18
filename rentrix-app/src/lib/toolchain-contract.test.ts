import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');

describe('Vite / Vitest supported combination', () => {
  it('pins Vitest 3.2 on the workspace Vite 7 line officially declared by Vitest 3.2.7', () => {
    const appPkg = JSON.parse(readFileSync(resolve(root, 'rentrix-app/package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    const workspace = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
    const lock = readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8');

    expect(appPkg.devDependencies.vitest).toBe('3.2.7');
    expect(appPkg.devDependencies['@vitest/coverage-v8']).toBe('3.2.7');
    expect(workspace).toMatch(/vite:\s*\^7\./);
    expect(lock).toContain('vitest@3.2.7');
    expect(lock).toContain('vite@7.3.2');
    // Vitest 2 pulled a private Vite 5 copy through @vitest/mocker. That dual
    // toolchain is the unsupported combination this pin replaces.
    expect(lock).not.toMatch(/vitest@2\./);
  });
});
