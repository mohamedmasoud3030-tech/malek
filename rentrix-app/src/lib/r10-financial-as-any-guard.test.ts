/**
 * R10 — Code Quality Debt Closure: financial `as any` freeze.
 *
 * The R10 order is: prevent NEW debt first, then remove the old by risk.
 * This guard pins the count of `as any` occurrences in financial-critical
 * service modules — the number can only go DOWN. Adding a new financial
 * `as any` fails this test; remove one and lower its baseline.
 *
 * (Generated Supabase types cover every RPC now — a new RPC must be added to
 * the migration chain and `pnpm db0:gen-types` re-run instead of casting.)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(process.cwd(), 'src');

/** Financial-critical directories under the freeze. */
const FINANCIAL_DIRS = [
  'features/financials',
  'features/owners/services',
  'features/accounting',
  'features/contracts/services',
  'features/maintenance',
  'features/dashboard',
];

/**
 * Baseline: current as-any debt per file with a SPECIFIC justification each.
 * Numbers may only DECREASE. A file not listed here has a baseline of 0.
 *
 * R10 cleanup already removed 19 casts in wp05Services, 8 RPC-name casts in
 * deposit-service, 6 in owner-settlements-service RPC calls, 2 in
 * receiptService void RPCs and 1 in maintenance-service — all were covered
 * by the regenerated Database types. The remaining entries are live-schema
 * compatibility reads (tables whose live column shape predates the generated
 * types), each to be retired when the corresponding read model lands.
 */
const AS_ANY_BASELINE: Readonly<Record<string, number>> = {
  // Dynamic receipts/payments union read + owners join with legacy display
  // columns not present in generated Row types (live-shape compatibility).
  'features/financials/receipts/receiptService.ts': 3,
  // owners/properties label reads select legacy display_name/name columns and
  // owner_settlements carries live-only columns — R2 read model consumes the
  // typed RPC instead; these list reads retire with the owners read model.
  'features/owners/services/owner-settlements-service.ts': 4,
};

function collect(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, files);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry) && !entry.endsWith('.e2e-fixture.tsx')) files.push(full);
  }
  return files;
}

function countAsAny(source: string): number {
  // Strip comments first: a comment MENTIONING the pattern is not debt.
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return (withoutComments.match(/\bas any\b/g) ?? []).length;
}

describe('R10 — financial as-any freeze (count only goes down)', () => {
  it('no financial file exceeds its as-any baseline', () => {
    const violations: string[] = [];
    for (const dir of FINANCIAL_DIRS) {
      for (const file of collect(join(SRC_ROOT, dir))) {
        const rel = relative(SRC_ROOT, file).split(sep).join('/');
        const count = countAsAny(readFileSync(file, 'utf8'));
        const baseline = AS_ANY_BASELINE[rel] ?? 0;
        if (count > baseline) {
          violations.push(`${rel}: ${count} > baseline ${baseline}`);
        }
      }
    }
    expect(
      violations,
      `NEW financial 'as any' debt detected — regenerate types (pnpm db0:gen-types) or type properly:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('baselines reference existing files (self-pruning)', () => {
    for (const rel of Object.keys(AS_ANY_BASELINE)) {
      expect(() => statSync(join(SRC_ROOT, rel)), `${rel} missing — prune the baseline`).not.toThrow();
    }
  });
});
