/**
 * R3 — Money Contract architecture guard.
 *
 * OMR is a 3-decimal currency (1 OMR = 1000 baisa). The server accounting
 * layer rounds with public._r3 / numeric(18,3); the frontend must never apply
 * 2-decimal monetary precision. This guard scans the ENTIRE src tree and fails
 * when a forbidden monetary pattern returns:
 *
 *   1. step="0.01" on money inputs (allowed only on the explicit non-money
 *      allowlist below: percentages / physical areas).
 *   2. toFixed(2) in monetary code (allowed only for non-money values:
 *      file sizes in MB, occupancy percentage).
 *   3. Math.round(x * 100) / 100 in monetary code (allowed only for
 *      percentage values).
 *   4. toFixed(3) inside a .tsx render surface — money must be displayed
 *      through the company formatter, not hand-rounded.
 *   5. hand-written currency words/symbols ("OMR", "ر.ع", "ريال") inside a
 *      component file — the ONE money presentation is the canonical
 *      "<number> <CODE>" string produced by formatCompanyMoney/formatMoney.
 *
 * Adding a new entry to an allowlist requires reviewing that the value is
 * genuinely NOT money. Money uses `@/lib/money` (MONEY_STEP / roundMoney).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(process.cwd(), 'src');

/** Lines allowed to keep step="0.01" — every one is a NON-money quantity. */
const STEP_001_ALLOWLIST: ReadonlyArray<{ file: string; mustContain: string }> = [
  // Commission percentage (a rate, not an amount).
  { file: 'features/commissions/components/commissions-view.tsx', mustContain: 'draft.percentage' },
  // Physical land area in square metres.
  { file: 'features/lands/components/lands-view.tsx', mustContain: 'المساحة' },
  // Ownership percentage (0–100 share).
  { file: 'features/owners/components/owner-relationships.tsx', mustContain: 'ownership_percentage' },
];

/** Files allowed to use toFixed(2) — every use is a NON-money value. */
const TO_FIXED_2_ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  { file: 'features/ai-assistant/services/ai-assistant-service.ts', reason: 'occupancy percentage' },
  { file: 'features/documents-vault/components/documents-vault-workspace.tsx', reason: 'file size in MB' },
  { file: 'features/documents-vault/documents-vault-service.ts', reason: 'file size limit message in MB' },
  { file: 'components/ui/file-picker-field.tsx', reason: 'file size in MB on the selected file chip' },
];

/** Files allowed to use Math.round(x*100)/100 — every use is a percentage. */
const ROUND_100_ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  { file: 'features/owners/services/owner-service.ts', reason: 'ownership percentage share' },
];

/**
 * UI files allowed to mention a currency word/symbol in source.
 *
 * Money VALUES must always render through `formatCompanyMoney` /
 * `formatMoney`, which emits the canonical `<number> <CODE>` presentation
 * (e.g. "1,234.500 OMR") at the currency's real minor unit. The entries below
 * are prose or developer-demo surfaces, not rendered monetary values.
 */
const CURRENCY_LITERAL_ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  { file: 'features/design-system/design-system-showcase.tsx', reason: 'DEV-only design-system demo with hand-typed sample strings' },
  { file: 'features/landing/i18n/messages.ts', reason: 'marketing FAQ prose naming supported currencies' },
  { file: 'features/properties/property-form-modal.tsx', reason: 'commission unit words inside field labels, not a formatted amount' },
  { file: 'features/reports/components/GeneralLedgerCoreSection.tsx', reason: 'resolves the company currency CODE for a data request' },
];

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectSourceFiles(full, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry) && !entry.endsWith('.e2e-fixture.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const sourceFiles = collectSourceFiles(SRC_ROOT);

function rel(file: string) {
  return relative(SRC_ROOT, file).split(sep).join('/');
}

describe('R3 money contract guard (OMR = 3 decimals)', () => {
  it('no money input uses step="0.01" outside the reviewed non-money allowlist', () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('step="0.01"')) continue;
      const relPath = rel(file);
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (!line.includes('step="0.01"')) return;
        const allowed = STEP_001_ALLOWLIST.some(
          (entry) => entry.file === relPath && line.includes(entry.mustContain),
        );
        if (!allowed) violations.push(`${relPath}:${index + 1}`);
      });
    }
    expect(violations, `money inputs must use MONEY_STEP from @/lib/money — found step="0.01" at:\n${violations.join('\n')}`).toEqual([]);
  });

  it('no monetary toFixed(2) outside the reviewed non-money allowlist', () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('toFixed(2)')) continue;
      const relPath = rel(file);
      if (TO_FIXED_2_ALLOWLIST.some((entry) => entry.file === relPath)) continue;
      violations.push(relPath);
    }
    expect(violations, `monetary values must round via roundMoney (3dp) — found toFixed(2) in:\n${violations.join('\n')}`).toEqual([]);
  });

  it('no monetary Math.round(x*100)/100 outside the reviewed percentage allowlist', () => {
    const pattern = /Math\.round\([^)]*\*\s*100\s*\)\s*\/\s*100(?!0)/;
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      if (!pattern.test(source)) continue;
      const relPath = rel(file);
      if (ROUND_100_ALLOWLIST.some((entry) => entry.file === relPath)) continue;
      violations.push(relPath);
    }
    expect(violations, `monetary rounding must use roundMoney (3dp) — found 2dp rounding in:\n${violations.join('\n')}`).toEqual([]);
  });

  it('no .tsx render surface hand-rounds money with toFixed(3)', () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      if (!file.endsWith('.tsx')) continue;
      const source = readFileSync(file, 'utf8');
      if (!source.includes('toFixed(3)')) continue;
      violations.push(rel(file));
    }
    expect(
      violations,
      `monetary display must flow through formatCompanyMoney — found toFixed(3) in component files:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('no component file hand-writes a currency string instead of using the money formatter', () => {
    // Dots are required in the Arabic abbreviations so ordinary words that
    // merely contain the letters ر/ع (وسرعة, إدارة) are not false positives.
    const pattern = /OMR|ر\.ع\.?|ريال/;
    const violations: string[] = [];
    for (const file of sourceFiles) {
      // Presentation surfaces only. Service/domain modules legitimately carry
      // the currency CODE as data (defaults, CSV parsing, document payloads).
      if (!file.endsWith('.tsx')) continue;
      const relPath = rel(file);
      if (CURRENCY_LITERAL_ALLOWLIST.some((entry) => entry.file === relPath)) continue;
      const source = readFileSync(file, 'utf8');
      const match = source.match(pattern);
      if (match) violations.push(`${relPath} → "${match[0]}"`);
    }
    expect(
      violations,
      `use formatCompanyMoney/formatMoney for every monetary value — found hand-written currency text in:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('the allowlists only reference files that still exist and still match', () => {
    for (const entry of STEP_001_ALLOWLIST) {
      const source = readFileSync(join(SRC_ROOT, entry.file), 'utf8');
      expect(source, `${entry.file} no longer contains "${entry.mustContain}" — prune the allowlist`).toContain(entry.mustContain);
    }
    for (const entry of [...TO_FIXED_2_ALLOWLIST, ...ROUND_100_ALLOWLIST, ...CURRENCY_LITERAL_ALLOWLIST]) {
      expect(() => statSync(join(SRC_ROOT, entry.file)), `${entry.file} missing — prune the allowlist`).not.toThrow();
    }
  });
});
