import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..');
const cwd = resolve(import.meta.dirname, '..', '..', '..');

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) return collectFiles(full);
    if (/\.(ts|tsx)$/.test(e.name)) return [full];
    return [];
  });
}

function countPattern(root: string, pattern: RegExp, exclude?: RegExp): number {
  let n = 0;
  for (const f of collectFiles(root)) {
    if (exclude?.test(f)) continue;
    const c = readFileSync(f, 'utf8');
    const m = c.match(pattern);
    if (m) n += m.length;
  }
  return n;
}

describe('design-system inventory — production reality (no redesign in Phase 1)', () => {
  it('pins enterprise/* production inventory: intimately zero prod consumers', () => {
    // All enterprise imports outside components/enterprise + design-system showcase = violation
    const pattern = /from\s+['"]@\/components\/enterprise/g;
    let prodConsumers = 0;
    for (const f of collectFiles(resolve(SRC, 'features'))) {
      if (/\.test\.(ts|tsx)$/.test(f)) continue;
      const c = readFileSync(f, 'utf8');
      if (pattern.test(c)) prodConsumers++;
    }
    for (const f of collectFiles(resolve(SRC, 'app'))) {
      if (/\.test\.(ts|tsx)$/.test(f)) continue;
      const c = readFileSync(f, 'utf8');
      if (pattern.test(c)) prodConsumers++;
    }
    // design-system showcase is the only allowed prod-adjacent consumer (dev-only route)
    // features/design-system is excluded above? re-check explicitly:
    // If any feature prod file imports enterprise, fail.
    expect(prodConsumers).toBe(0);
  });

  it('counts PageHeader family usage in prod pages', () => {
    const layouts = collectFiles(resolve(SRC, 'components/layout'));
    const features = collectFiles(resolve(SRC, 'features'));
    const ui = collectFiles(resolve(SRC, 'components/ui'));
    const all = [...layouts, ...features, ...ui].filter((f) => !/\.test\./.test(f));
    let pageHeader = 0, sectionHeader = 0, entityDetail = 0, enterpriseHeader = 0;
    for (const f of all) {
      const c = readFileSync(f, 'utf8');
      if (c.includes('<PageHeader')) pageHeader++;
      if (c.includes('<SectionHeader')) sectionHeader++;
      if (c.includes('<EntityDetailHeader')) entityDetail++;
      if (c.includes('<EnterpriseHeader')) enterpriseHeader++;
    }
    expect(pageHeader).toBeGreaterThan(10);
    expect(sectionHeader).toBeGreaterThan(5);
    expect(enterpriseHeader).toBe(0);
    // snapshot inventory log (informational)
    // eslint-disable-next-line no-console
    console.log(`[design-inventory] PageHeader:${pageHeader} SectionHeader:${sectionHeader} EntityDetailHeader:${entityDetail} EnterpriseHeader:${enterpriseHeader}`);
  });

  it('logs hardcoded large radius / blur usage (inventory only, no enforcement yet)', () => {
    const featuresRoot = resolve(SRC, 'features');
    const compsRoot = resolve(SRC, 'components');
    const largeRadius = countPattern(featuresRoot, /rounded-\[1\.5rem\]|rounded-2xl/g);
    const blur = countPattern(featuresRoot, /blur-2xl|blur-\[110px\]/g);
    const compsRadius = countPattern(compsRoot, /rounded-\[1\.5rem\]|rounded-2xl/g);
    // Not enforcing — just pin numbers so Phase 2 can see drift
    expect(largeRadius + compsRadius).toBeGreaterThan(20);
    // eslint-disable-next-line no-console
    console.log(`[design-inventory] large-radius (features+comps): ${largeRadius + compsRadius}, blur: ${blur}`);
  });

  it('parallel page shells: only ListPage + EmbeddableWorkspace are in prod, EnterprisePage is frozen', () => {
    const features = collectFiles(resolve(SRC, 'features')).filter((f) => !/\.test\./.test(f));
    let enterprisePages = 0;
    for (const f of features) {
      const c = readFileSync(f, 'utf8');
      if (c.includes('EnterprisePage') || c.includes('EnterpriseHeader') || c.includes('EnterpriseDataTable')) enterprisePages++;
    }
    expect(enterprisePages).toBe(0);
  });
});
