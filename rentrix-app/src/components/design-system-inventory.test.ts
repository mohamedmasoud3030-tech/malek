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
    const allRoot = resolve(SRC);
    const count = countPattern(
      allRoot,
      /rounded-\[[^\]]+\]/g,
      /features[\\/]landing|\.test\.(ts|tsx)$/,
    );
    expect(count).toBe(0);
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
  // ─────────────────────────────────────────────────────────────────────────
  // Feature-local copies of unified primitives (2026-09-05 consolidation)
  //
  // `components/ui` (+ `components/layout`) is the ONLY home for shared
  // product primitives. Several features had grown private copies — a whole
  // parallel "finance visual foundations" layer, a per-feature checkbox, an
  // info-item, a money cell, a report link, a landing heading that shadowed
  // the canonical `SectionHeader` name. They were deleted and their call
  // sites moved onto the canonical components. These guards keep them gone.
  // ─────────────────────────────────────────────────────────────────────────

  const DELETED_FEATURE_DUPLICATES = [
    // replaced by Alert / FilterBar / KpiCard / ResponsiveCardGrid / StatusBadge
    // + AmountText, with the finance status mapping kept as domain logic in
    // features/financials/finance-status-mapping.ts
    'features/financials/components/finance-reporting-visual-foundations.tsx',
    // replaced by canonical ReportPanel/ReportList/ReportListRow/ReportState
    'features/dashboard/components/dashboard-signal-primitives.tsx',
    // replaced by canonical DetailFields
    'features/properties/components/property-info-item.tsx',
    // replaced by canonical AmountText
    'features/units/components/unit-cells.tsx',
    // replaced by canonical Checkbox
    'features/owners/components/owner-checkbox.tsx',
    // SafeAnchor replaced by canonical EntityLink
    'features/reports/components/common.tsx',
    // renamed: the canonical SectionHeader name belongs to components/ui alone
    'features/landing/components/SectionHeader.tsx',
  ] as const;

  it('keeps the deleted feature-local copies of unified primitives deleted', () => {
    for (const rel of DELETED_FEATURE_DUPLICATES) {
      expect(existsSync(resolve(SRC, rel)), `${rel} must stay deleted — use the canonical components/ui primitive`).toBe(false);
    }
  });

  it('prohibits feature-local components that shadow a canonical primitive name', () => {
    const canonicalNames = new Set<string>();
    for (const dir of ['components/ui', 'components/layout']) {
      for (const f of collectFiles(resolve(SRC, dir)).filter((f) => !/\.test\./.test(f))) {
        const c = readFileSync(f, 'utf8');
        for (const m of c.matchAll(/export\s+(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g)) canonicalNames.add(m[1]);
        for (const m of c.matchAll(/export\s*\{([^}]*)\}/g)) {
          for (const part of m[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/).pop()!.replace(/^type\s+/, '').trim();
            if (/^[A-Z]/.test(name)) canonicalNames.add(name);
          }
        }
      }
    }
    expect(canonicalNames.size).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const f of collectFiles(resolve(SRC, 'features')).filter((f) => !/\.test\.|e2e-fixture/.test(f))) {
      const c = readFileSync(f, 'utf8');
      for (const m of c.matchAll(/export\s+(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g)) {
        if (canonicalNames.has(m[1])) offenders.push(`${m[1]} ← ${f.replace(`${SRC}/`, '')}`);
      }
    }
    expect(offenders, `feature-local components must not shadow canonical primitives:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('prohibits parallel design-system layers inside features', () => {
    // A file named *primitives*/*foundations*/*design-system* inside a feature
    // is a second design system by definition. There are no exceptions left:
    // the finance visual foundations and the dashboard signal primitives were
    // both folded into components/ui (Alert/FilterBar/KpiCard/StatusBadge/
    // AmountText and ReportPanel/ReportList/ReportListRow/ReportState).
    const ALLOWED = new Set<string>([]);
    const offenders = collectFiles(resolve(SRC, 'features'))
      .filter((f) => !/\.test\.|e2e-fixture/.test(f))
      .filter((f) => /(primitives|foundations|design-system)\.(ts|tsx)$/.test(f))
      .map((f) => f.replace(`${SRC}/`, ''))
      .filter((rel) => !ALLOWED.has(rel));
    expect(offenders, `parallel primitive layers are prohibited inside features:\n${offenders.join('\n')}`).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Raw HTML controls & the tone vocabulary (2026-09-05 consolidation)
  //
  // A raw `<button>`/`<form>` is a second button/second form: it skips the
  // canonical press affordance, the 44px floor, `data-ui-button`, the
  // `data-entity-form` marker and the focus-first-invalid-field behaviour.
  // Likewise a re-spelled tone union is a parallel token system (UX-008).
  // ─────────────────────────────────────────────────────────────────────────

  /** Full-screen dismiss overlays are not controls; nothing else is exempt. */
  const RAW_CONTROL_ALLOWLIST = new Set<string>([
    'features/command-palette/command-palette-dialog.tsx',
  ]);

  it('keeps every raw <button>/<form> out of app code (canonical Button / EntityForm only)', () => {
    const prodFiles = collectFiles(SRC).filter(
      (f) => !/\.test\.|e2e-fixture/.test(f) && !/components\/ui\//.test(f),
    );
    const offenders: string[] = [];
    for (const f of prodFiles) {
      const rel = f.replace(`${SRC}/`, '');
      if (RAW_CONTROL_ALLOWLIST.has(rel)) continue;
      const c = readFileSync(f, 'utf8');
      for (const m of c.matchAll(/<(button|form)[\s>]/g)) {
        offenders.push(`${rel} → <${m[1]}>`);
      }
    }
    expect(
      offenders,
      `raw HTML controls must go through components/ui (Button / EntityForm.Root):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  const SEMANTIC_TONE_LITERALS = ['success', 'warning', 'danger', 'info', 'neutral', 'primary', 'secondary'];
  const TONE_UNION = new RegExp(
    `(?:'(?:${SEMANTIC_TONE_LITERALS.join('|')})'\\s*\\|\\s*)+'(?:${SEMANTIC_TONE_LITERALS.join('|')})'`,
    'g',
  );

  it('keeps the semantic tone vocabulary spelled in exactly one place', () => {
    // 4+ semantic literals in a union is a re-declaration of the canonical
    // `SemanticTone`. Narrower unions (a 3-step severity scale, say) are a
    // domain constraint, not a second vocabulary, and stay allowed.
    const offenders: string[] = [];
    for (const f of collectFiles(SRC).filter((x) => !/\.test\.|e2e-fixture/.test(x))) {
      const rel = f.replace(`${SRC}/`, '');
      // The vocabulary's home — the only file allowed to spell it out. Every
      // other file (including the rest of components/ui) derives its subset.
      if (rel.endsWith('components/ui/status-badge.tsx')) continue;
      const c = readFileSync(f, 'utf8');
      for (const m of c.matchAll(TONE_UNION)) {
        if ((m[0].match(/'/g) ?? []).length / 2 >= 4) offenders.push(`${rel} → ${m[0]}`);
      }
    }
    expect(
      offenders,
      `import SemanticTone from @/components/ui/status-badge instead of re-spelling it:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
