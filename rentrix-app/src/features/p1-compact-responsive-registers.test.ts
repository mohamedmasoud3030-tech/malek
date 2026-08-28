import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVE_REGISTER_INVENTORY } from './active-register-inventory';

const featuresRoot = new URL('./', import.meta.url);
const registerRoots = ['people', 'owners', 'tenants', 'contracts', 'lands', 'commissions', 'financials', 'properties', 'units', 'maintenance', 'utilities', 'leads', 'communication', 'automation', 'audit', 'reports', 'service-providers'];

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

describe('P1 — shared responsive register contract', () => {
  it('uses one EntityTable/DataTable foundation with a persistent cards-table choice on every viewport', () => {
    const productionSources = registerRoots.flatMap(sourceFiles).map((path) => readFileSync(path, 'utf8'));
    expect(productionSources.some((source) => source.includes('renderMobileCard'))).toBe(false);
    const sharedRegister = readFileSync(new URL('../components/ui/entity-table.tsx', import.meta.url), 'utf8');
    expect(sharedRegister).toContain('data-compact-responsive-table');
    expect(sharedRegister).toContain('data-entity-table-scroll');
    expect(sharedRegister).toContain('data-entity-table-grid');
    expect(sharedRegister).toContain("type ViewMode = 'cards' | 'table'");
    expect(sharedRegister).toContain('DEFAULT_VIEW_MODE_STORAGE_KEY');
    expect(sharedRegister).toContain("window.localStorage.setItem(storageKey, nextMode)");
    expect(sharedRegister).toContain('طريقة عرض ${ariaLabel}');
    expect(sharedRegister).toContain('mobileCardType?: EntityCardType');
    expect(sharedRegister).toContain('inline-flex min-h-11');
    expect(sharedRegister).toContain("viewMode === 'cards' ? (");
    expect(sharedRegister).not.toContain('md:inline-flex');
    expect(sharedRegister).not.toContain("viewMode === 'cards' ? 'hidden' : 'hidden md:block'");
  });

  it('regression guard — every active register still routes through the shared responsive foundation', () => {
    const componentRoot = new URL('../', import.meta.url);
    for (const entry of ACTIVE_REGISTER_INVENTORY) {
      const absolute = new URL(entry.component, componentRoot);
      const code = readFileSync(absolute, 'utf8');
      expect(code, `${entry.component} must use the shared register foundation`).toMatch(/\b(EntityTable|DataTable)\b/);
      // No silent bypasses: no raw table import, no horizontal-scroll wrapper,
      // no fixed table min-width, no page-specific mobile card renderer.
      expect(code, `${entry.component} must not import the raw table primitive`).not.toMatch(/from\s+['"]@\/components\/ui\/table['"]/);
      expect(code, `${entry.component} must not use mobile-scroll-x`).not.toContain('mobile-scroll-x');
      expect(code, `${entry.component} must not fix a table min-width`).not.toMatch(/min-w-\[[0-9]+rem\]/);
      expect(code, `${entry.component} must not ship a page-specific mobile card`).not.toMatch(/data-mobile-card|data-finance-mobile-card|MobileCard|ContractMobileCard/);
    }
  });
});