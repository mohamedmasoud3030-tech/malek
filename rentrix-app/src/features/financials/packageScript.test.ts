import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('financials package test script', () => {
  it('runs the standard regression suite via Vitest discovery and exposes an explicit financials suite', async () => {
    const packageJsonPath = resolve(import.meta.dirname, '../../../package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
    const standardSuite = packageJson.scripts?.test ?? '';

    expect(standardSuite).toBe('vitest run --config vite.config.ts');
    expect(standardSuite).not.toContain('src/');
    expect(packageJson.scripts?.['test:financials']).toBe('vitest run --config vite.config.ts --dir src/features/financials');
  });
});
