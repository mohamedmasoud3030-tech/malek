import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('financials package test script', () => {
  it('runs the standard regression suite with accessibility isolated behind its dedicated gate', async () => {
    const packageJsonPath = resolve(import.meta.dirname, '../../../package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
    const standardSuite = packageJson.scripts?.test ?? '';

    expect(standardSuite).toBe('vitest run --config vite.config.ts --exclude src/components/ui/primitives.axe.test.tsx');
    expect(packageJson.scripts?.['test:a11y-primitives']).toBe(
      'vitest run --config vite.config.ts src/components/ui/primitives.axe.test.tsx',
    );
    expect(packageJson.scripts?.['test:financials']).toBe('vitest run --config vite.config.ts --dir src/features/financials');
  });
});
