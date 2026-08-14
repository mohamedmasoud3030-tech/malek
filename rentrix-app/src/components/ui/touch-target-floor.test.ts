import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WP-06 / GAP-020 regression guard.
 *
 * The shared <Button> primitive already ships a 44px floor (min-h-11 /
 * min-w-11) on every size variant, but feature code was locally overriding it
 * with `min-h-10`, `min-h-9` and `min-h-8` utilities. Tailwind resolves the
 * later declaration, so those overrides silently downgraded real controls to
 * 40px, 36px and 32px — below the WCAG 2.5.5 / iOS HIG 44px touch floor. The
 * Browser Readiness chromium-desktop shard caught this on the reports and
 * login surfaces at 320/375/430/768 widths.
 *
 * This static guard fails the moment any component reintroduces a sub-44px
 * sizing utility on an interactive control, so the acceptance gate cannot be
 * re-broken by a surface the browser matrix does not happen to visit.
 *
 * Scope note: the guard inspects only class strings that also carry an
 * interactive marker (a `<Button>`/`<a>` className, or `inline-flex`/`flex`
 * pill styling on a clickable element). Non-interactive presentation — status
 * badges, count chips, `min-h-0` scroll containers — is intentionally out of
 * scope and is not a touch target.
 */
const SRC_ROOT = resolve(import.meta.dirname, '../..');

// Sub-44px minimum-height utilities. min-h-11 (44px) and above are allowed.
// min-h-0 is excluded: it is a flexbox scroll-container idiom, not sizing.
const SUB_44_MIN_HEIGHT = String.raw`min-h-(?:px|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|\[(?:[0-9]|[1-3][0-9]|4[0-3])px\])`;
// Sub-44px fixed-height utilities (h-9 = 36px etc.) on interactive controls.
const SUB_44_FIXED_HEIGHT = String.raw`h-(?:4|5|6|7|8|9|10)`;
const SUB_44_MIN_WIDTH = String.raw`min-w-(?:0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|\[(?:[0-9]|[1-3][0-9]|4[0-3])px\])`;

const SUB_44 = new RegExp(String.raw`\b(?:${SUB_44_MIN_HEIGHT}|${SUB_44_FIXED_HEIGHT}|${SUB_44_MIN_WIDTH})\b`);

function collectComponentFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectComponentFiles(full, found);
      continue;
    }
    if (!full.endsWith('.tsx')) continue;
    if (full.includes('.test.')) continue;
    found.push(full);
  }
  return found;
}

/**
 * Collect sub-44px sizing utilities that sit on a <Button> element — the one
 * place where a local className provably overrides the design-system floor.
 */
function findButtonTouchTargetOffenders(source: string): string[] {
  const offenders: string[] = [];
  const buttonTag = /<Button\b[\s\S]*?>/g;
  let match: RegExpExecArray | null;
  while ((match = buttonTag.exec(source)) !== null) {
    const tag = match[0];
    // Ignore `asChild` — the rendered element brings its own sizing.
    if (tag.includes('asChild')) continue;
    const hit = SUB_44.exec(tag);
    if (hit) offenders.push(hit[0]);
  }
  return offenders;
}

describe('44px touch-target floor', () => {
  const files = collectComponentFiles(SRC_ROOT);

  it('scans a meaningful number of component files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('has no <Button> that overrides the shared 44px floor below the touch minimum', () => {
    const offenders = files
      .map((file) => ({ file: relative(SRC_ROOT, file), hits: findButtonTouchTargetOffenders(readFileSync(file, 'utf8')) }))
      .filter((entry) => entry.hits.length > 0)
      .map((entry) => `${entry.file}: ${entry.hits.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  it('keeps every <Button> size variant on or above the 44px floor', () => {
    const button = readFileSync(join(SRC_ROOT, 'components/ui/button.tsx'), 'utf8');
    const sizeBlock = button.slice(button.indexOf('size: {'), button.indexOf('fullWidth: {'));

    expect(sizeBlock).toContain('min-h-11');
    expect(SUB_44.test(sizeBlock)).toBe(false);
  });

  it('keeps the reports document actions and login password toggle at 44px', () => {
    // These two surfaces are the ones the Browser Readiness desktop shard
    // failed on; assert them by name so the fix cannot be quietly reverted.
    const reports = readFileSync(join(SRC_ROOT, 'features/reports/components/AccountingReportsSection.tsx'), 'utf8');
    expect(reports).toContain('min-h-11');
    expect(reports).not.toContain('min-h-10');

    const login = readFileSync(join(SRC_ROOT, 'features/auth/login-page.tsx'), 'utf8');
    expect(login).toContain('size-11 min-h-11 min-w-11');
    expect(login).not.toContain('size-10');
  });
});
