import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const featuresRoot = new URL('./', import.meta.url);
const registerRoots = ['people', 'owners', 'tenants', 'contracts', 'lands', 'commissions', 'financials', 'properties', 'units', 'maintenance', 'utilities', 'leads', 'communication', 'automation', 'audit'];

function sourceFiles(directory: string): string[] {
  const absolute = new URL(`./${directory}/`, featuresRoot);
  if (!statSync(absolute, { throwIfNoEntry: false })) return [];
  const files: string[] = [];
  for (const name of readdirSync(absolute)) {
    const path = new URL(name, absolute);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(`${directory}/${name}`));
    else if (name.endsWith('.tsx')) files.push(path.pathname);
  }
  return files;
}

describe('P1 — compact responsive register contract', () => {
  it('uses one EntityTable/DataTable foundation and does not render legacy mobile cards in registers', () => {
    const productionSources = registerRoots.flatMap(sourceFiles).map((path) => readFileSync(path, 'utf8'));
    expect(productionSources.some((source) => source.includes('renderMobileCard'))).toBe(false);
    expect(productionSources.some((source) => source.includes('enableViewModeToggle'))).toBe(false);
    expect(readFileSync(new URL('../components/ui/entity-table.tsx', import.meta.url), 'utf8')).toContain('data-compact-responsive-table');
  });
});
