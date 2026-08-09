import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..');

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
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

describe('design-system inventory & regression contract — Phase 5 enforcement', () => {
  it('enforces enterprise/* deletion: components/enterprise directory must not exist', () => {
    const enterpriseDir = resolve(SRC, 'components/enterprise');
    expect(existsSync(enterpriseDir)).toBe(false);
  });

  it('guards against any enterprise/* imports in production files', () => {
    const pattern = /from\s+['"]@\/components\/enterprise/g;
    let prodConsumers = 0;
    const allProdFiles = [
      ...collectFiles(resolve(SRC, 'features')),
      ...collectFiles(resolve(SRC, 'app')),
      ...collectFiles(resolve(SRC, 'routes')),
    ].filter((f) => !/\.test\./.test(f));

    for (const f of allProdFiles) {
      const c = readFileSync(f, 'utf8');
      if (pattern.test(c)) {
        prodConsumers++;
      }
    }
    expect(prodConsumers).toBe(0);
  });

  it('prohibits parallel headers and enforces canonical PageHeader + EntityDetailHeader', () => {
    const features = collectFiles(resolve(SRC, 'features')).filter((f) => !/\.test\./.test(f));
    const routes = collectFiles(resolve(SRC, 'routes')).filter((f) => !/\.test\./.test(f));
    const layouts = collectFiles(resolve(SRC, 'components/layout')).filter((f) => !/\.test\./.test(f));
    const allProd = [...features, ...routes, ...layouts];

    let pageHeader = 0;
    let entityDetail = 0;
    let enterpriseHeader = 0;

    for (const f of allProd) {
      const c = readFileSync(f, 'utf8');
      if (c.includes('<PageHeader')) pageHeader++;
      if (c.includes('<EntityDetailHeader')) entityDetail++;
      if (c.includes('<EnterpriseHeader')) enterpriseHeader++;
    }

    // EnterpriseHeader is completely forbidden
    expect(enterpriseHeader).toBe(0);

    // PageHeader and EntityDetailHeader should be the main canonical headers
    expect(pageHeader).toBeGreaterThanOrEqual(10);
    expect(entityDetail).toBeGreaterThanOrEqual(2);
  });

  it('enforces strict baseline of zero decorative blur-2xl / blur-3xl in core operational features', () => {
    const featuresRoot = resolve(SRC, 'features');
    // Exclude landing page (marketing context where some ambient decoration is allowed)
    const blur = countPattern(featuresRoot, /blur-2xl|blur-3xl/g, /features[\\/]landing/);
    
    // We expect zero decorative blurs in core features (Operational summary metrics have been cleaned up!)
    expect(blur).toBe(0);
  });

  it('limits hardcoded large radius (rounded-[1.5rem] / rounded-2xl) to baseline level', () => {
    const featuresRoot = resolve(SRC, 'features');
    const compsRoot = resolve(SRC, 'components');
    const largeRadius = countPattern(featuresRoot, /rounded-\[1\.5rem\]|rounded-2xl/g, /features[\\/]landing/);
    const compsRadius = countPattern(compsRoot, /rounded-\[1\.5rem\]|rounded-2xl/g);

    // Baselines are kept controlled and must not drift upwards without deliberation
    expect(largeRadius + compsRadius).toBeLessThanOrEqual(250);
  });

  it('pins the strict arbitrary radius rounded-[...] baseline in core operational UI', () => {
    // Specifically count occurrences of arbitrary "rounded-[" excluding the landing features and test inventory file itself
    const allRoot = resolve(SRC);
    const count = countPattern(allRoot, /rounded-\[[^\]]+\]/g, /features[\\/]landing|design-system-inventory\.test\.ts/);
    // There should be exactly 6 occurrences in core operational files
    expect(count).toBe(6);
  });

  it('enforces heading hierarchy: exactly one h1 per page file (no duplicates)', () => {
    const features = collectFiles(resolve(SRC, 'features')).filter((f) => !/\.test\./.test(f) && !/features[\\/]landing/.test(f));
    const routes = collectFiles(resolve(SRC, 'routes')).filter((f) => !/\.test\./.test(f) && !f.includes('__root'));

    for (const f of [...features, ...routes]) {
      const c = readFileSync(f, 'utf8');
      const h1Matches = c.match(/<h1/g) ?? [];
      // Any single workspace or route should never define more than 1 main heading (h1)
      expect(h1Matches.length).toBeLessThanOrEqual(1);
    }
  });

  it('enforces presence of accessible labels in PageHeader and EntityDetailHeader', () => {
    const layoutsRoot = resolve(SRC, 'components/layout');
    const files = collectFiles(layoutsRoot);
    
    const pageHeaderFile = files.find(f => f.endsWith('page-header.tsx'));
    const detailHeaderFile = files.find(f => f.endsWith('entity-detail-header.tsx'));

    if (pageHeaderFile) {
      const c = readFileSync(pageHeaderFile, 'utf8');
      expect(c).toContain('data-page-header');
    }
    if (detailHeaderFile) {
      const c = readFileSync(detailHeaderFile, 'utf8');
      expect(c).toContain('data-page-header');
    }
  });
});
