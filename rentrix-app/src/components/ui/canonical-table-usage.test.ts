import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(uiDir, '../..');
const canonicalTablePath = resolve(uiDir, 'table.tsx');

function collectReactSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return collectReactSourceFiles(path);
    if (extname(entry.name) !== '.tsx') return [];
    if (/\.(?:test|spec)\.tsx$/.test(entry.name)) return [];
    return [path];
  });
}

describe('canonical table usage', () => {
  it('keeps raw HTML tables inside the single shared Table primitive', () => {
    const offenders = collectReactSourceFiles(srcDir)
      .filter((path) => path !== canonicalTablePath)
      .filter((path) => /<table(?:\s|>)/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(srcDir, path))
      .sort();

    expect(offenders).toEqual([]);
  });
});
