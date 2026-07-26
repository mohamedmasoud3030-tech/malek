import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const arabicIndicDigitPattern = /[٠-٩]/;
const intentionalInputNormalizationFiles = new Set([
  'features/contracts/hooks/useContractFilters.ts',
  'features/owners/utils/owner-ui-helpers.ts',
]);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    return [entryPath];
  });
}

describe('Latin numeral UI contract', () => {
  it('keeps Arabic-Indic digits out of user-facing source text', () => {
    const violations = collectSourceFiles(sourceRoot)
      .map((filePath) => relative(sourceRoot, filePath).replaceAll('\\', '/'))
      .filter((relativePath) => !intentionalInputNormalizationFiles.has(relativePath))
      .filter((relativePath) => arabicIndicDigitPattern.test(readFileSync(join(sourceRoot, relativePath), 'utf8')));

    expect(violations).toEqual([]);
  });
});
