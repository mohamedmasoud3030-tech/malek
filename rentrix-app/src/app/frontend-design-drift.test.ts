import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Frontend design-drift guardrail — يحمي هوية MALEK البصرية الموحدة.
 *
 * The authenticated application must express color, radius and elevation
 * through the canonical token system (styles/tokens.css + the Tailwind v4
 * bridge). This test scans production source (not tests/fixtures/showcases)
 * and fails when a file reintroduces:
 *
 *   1. raw Tailwind palette utilities (bg-slate-…, text-emerald-800, …)
 *   2. hard-coded hex colors
 *   3. off-scale radii (rounded-3xl/4xl/arbitrary values)
 *   4. one-off heavy shadows (shadow-lg/xl/2xl — use shadow-elevated)
 *
 * Approved exclusions:
 *   - features/landing/**  — public marketing surface, outside the
 *     authenticated-app closeout
 *   - services/documents/renderer/** — the A4 print engine keeps a fixed
 *     standalone palette so printed financial/legal documents do not drift
 *     when theme tokens change (ADR 0014 print surface)
 *   - features/design-system/design-system-showcase.tsx — DEV-only surface
 *     that intentionally displays swatches
 *   - *.test.*, *.e2e-fixture.* — tests and hermetic fixtures
 *
 * Behavioral contract tests (preferred over class assertions) live with the
 * components they protect; this file only blocks the class-level drift that
 * no component test can see.
 */

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const EXCLUDED_SEGMENTS = new Set([
  'features/landing',
  'services/documents',
  'features/design-system/design-system-showcase.tsx',
]);

const PALETTE_NAMES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const RAW_PALETTE_UTILITY =
  new RegExp(`\\b(?:bg|text|border|ring|from|to|via|divide|outline|fill|stroke|shadow|decoration|caret|accent)-(?:${PALETTE_NAMES})-\\d{2,3}\\b`, 'g');

const HEX_COLOR = /#(?=[0-9a-fA-F]{3,8}\b)[0-9a-fA-F]*[a-fA-F][0-9a-fA-F]*/g;

const OFF_SCALE_RADIUS = /rounded-(?:3xl|4xl|\[[^\]]+\])/g;

const HEAVY_ONE_OFF_SHADOW = /shadow-(?:lg|xl|2xl)/g;

function isExcluded(relativePath: string): boolean {
  if (/\.test\.(ts|tsx)$/.test(relativePath) || /\.e2e-fixture\.(ts|tsx)$/.test(relativePath)) return true;
  return [...EXCLUDED_SEGMENTS].some((segment) => relativePath.startsWith(segment));
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'styles' || entry === 'dist') continue;
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

interface Violation {
  file: string;
  line: number;
  text: string;
}

function scan(rule: RegExp, label: string, violations: Violation[]): void {
  for (const file of collectSourceFiles(srcDir)) {
    const rel = relative(srcDir, file);
    if (isExcluded(rel)) continue;
    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(rule)) {
        violations.push({ file: rel, line: index + 1, text: `${label}: ${match[0].trim()}` });
      }
    });
  }
}

describe('frontend design drift — authenticated surfaces stay on the token system', () => {
  it('no raw Tailwind palette utilities outside approved print/landing surfaces', () => {
    const violations: Violation[] = [];
    scan(RAW_PALETTE_UTILITY, 'raw palette class', violations);
    expect(format(violations)).toBe('');
  });

  it('no hard-coded hex colors outside approved print/landing surfaces', () => {
    const violations: Violation[] = [];
    scan(HEX_COLOR, 'hard-coded hex', violations);
    expect(format(violations)).toBe('');
  });

  it('no off-scale border radii (rounded-2xl is the canonical elevated surface)', () => {
    const violations: Violation[] = [];
    scan(OFF_SCALE_RADIUS, 'off-scale radius', violations);
    expect(format(violations)).toBe('');
  });

  it('no one-off heavy shadows (use shadow-card / shadow-elevated)', () => {
    const violations: Violation[] = [];
    scan(HEAVY_ONE_OFF_SHADOW, 'one-off shadow', violations);
    expect(format(violations)).toBe('');
  });
});

function format(violations: Violation[]): string {
  if (violations.length === 0) return '';
  return violations
    .slice(0, 25)
    .map((violation) => `  ${violation.file}:${violation.line} — ${violation.text}`)
    .join('\n');
}
