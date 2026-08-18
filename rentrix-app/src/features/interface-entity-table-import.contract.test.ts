import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name) && !name.includes('.test.') && !name.includes('e2e') && !name.includes('fixture')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Production features should import the canonical EntityTable module.
 * DataTable remains a compatibility re-export from entity-table.tsx / ui/index.
 */
describe('EntityTable import consistency', () => {
  const files = walk(srcRoot).filter((f) => f.includes(`${srcRoot}/features/`));

  it('has no production feature imports from ui/data-table path', () => {
    const offenders = files
      .filter((f) => {
        const text = readFileSync(f, 'utf8');
        return /from ['"]@\/components\/ui\/data-table['"]/.test(text);
      })
      .map((f) => relative(srcRoot, f));
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('keeps the DataTable alias module as a thin re-export only', () => {
    const alias = readFileSync(resolve(srcRoot, 'components/ui/data-table.tsx'), 'utf8');
    expect(alias).toContain("from './entity-table'");
    expect(alias).toContain('EntityTable as DataTable');
    expect(alias).not.toMatch(/function DataTable|const DataTable\s*=/);
  });
});
