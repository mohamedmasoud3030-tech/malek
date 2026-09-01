import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * UX foundation contract — يحمي قواعد سطح الهاتف التي يصعب التقاطها بوحدات المكوّنات:
 *
 * 1. مساحة التحكم العائم على الموبايل هي متغير مركزي واحد (--mobile-floating-control-height)
 *    ومساحة التحرُّر أسفل الصفحة مشتقة منه (لا أرقام سحرية مكررة).
 * 2. حالات الضغط (press/anti-ghost-hover) محصورة في أجهزة لمس حقيقية
 *    (hover: none) وإلا أجهزة اللابتوب الهجينة تفقد حالات hover الحقيقية بالماوس.
 *    هذه القواعد بصرية بالدرجة الأولى، لذا مالكها هو طبقة MALEK النهائية
 *    (malek-pro-visual-wave.css) وليس هذا الملف — الطبقة هنا تبني الهيكل فقط.
 * 3. توهُّجات أطراف FilterTabs لا تظهر أبدًا أثناء وجود تركيز لوحة المفاتيح
 *    داخل الممر (وإلا أخفت حلقات التركيز على الألسنة الطرفية).
 * 4. حارس تكبير الإدخال في iOS محصور بعرض الهاتف فقط — iPad/الأسطح الأوسع
 *    تحتفظ بأحجام خطوط المكوّنات.
 * 5. الشاشات الضيقة جدًا (≤359px) تُقلّص حشوة بطاقات الكيانات.
 * 6. تقسيم الملكية: هذا الملف لا يكتب حبرًا بصريًا، والـ wave لا يكتب هندسة.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const ux = readFileSync(resolve(stylesDir, 'ux-foundation.css'), 'utf8');
const wave = readFileSync(resolve(stylesDir, 'malek-pro-visual-wave.css'), 'utf8');

/** CSS comments document intent but never affect the cascade — strip them so a
 *  guard cannot be satisfied (or tripped) by prose. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function mediaBlock(source: string, query: string): string {
  const start = source.indexOf(`@media ${query}`);
  if (start < 0) return '';
  // Balance braces from the first '{'.
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i);
  }
  return source.slice(start);
}

describe('ux foundation — mobile surface contracts', () => {
  it('derives the mobile bottom-nav clearance from one central height token', () => {
    expect(ux).toContain('--mobile-floating-control-height: 3.75rem');
    const clearance = mediaBlock(ux, '(max-width: 767px)');
    expect(clearance).toContain('var(--mobile-floating-control-height)');
    expect(clearance).toContain('env(safe-area-inset-bottom');
    expect(clearance).not.toContain('calc(3.75rem');
  });

  it('scopes press states and the ghost-hover guard to true touch devices (hover: none)', () => {
    const block = mediaBlock(wave, '(hover: none) and (pointer: coarse)');
    expect(block).toContain('[data-entity-card]:active');
    expect(block).toContain(':hover:not(:active)');
  });

  it('never applies the press/ghost-hover overrides to hybrid pointer devices', () => {
    // The real invariant: any hover/press STATE rule must live inside a block
    // gated on (hover: none). Bare (pointer: coarse) blocks here are touch
    // targets, kinetic scrolling and touch-action — affordances that are
    // correct on every coarse device and must never carry a :hover override.
    for (const source of [ux, wave]) {
      const clean = withoutComments(source);
      const blocks = [...clean.matchAll(/@media([^{]*)\{([\s\S]*?)\n\}/g)];
      for (const [, query, body] of blocks) {
        if (query.includes('hover: none')) continue;
        expect(body).not.toMatch(/:hover/);
        expect(body).not.toMatch(/:active/);
      }
    }

    // The press guard itself must exist exactly once, in the visual owner.
    expect(wave.match(/@media \(hover: none\) and \(pointer: coarse\)/g)).toHaveLength(1);
    expect(ux).not.toContain('hover: none');
  });

  it('hides the FilterTabs edge fades while keyboard focus is inside the scroller', () => {
    expect(ux).toContain(
      "[data-filter-tabs-wrapper][data-can-scroll-start='true']:not(:focus-within)::before",
    );
    expect(ux).toContain(
      "[data-filter-tabs-wrapper][data-can-scroll-end='true']:not(:focus-within)::after",
    );
    // And fades still activate on real overflow (the data attributes remain the trigger).
    expect(ux).not.toContain("[data-can-scroll-start='true']::before,\n[data-filter-tabs-wrapper][data-can-scroll-end='true']::after {");
  });

  it('restricts the iOS input-zoom guard to phone widths', () => {
    const supportsStart = ux.indexOf('@supports (-webkit-touch-callout: none)');
    expect(supportsStart).toBeGreaterThan(-1);
    const supportsBody = ux.slice(supportsStart);
    expect(supportsBody).toContain('@media (max-width: 639px)');
    expect(supportsBody).toContain('font-size: max(1rem, 16px)');
    expect(supportsBody).not.toContain('@media (min-width: 640px)');
  });

  it('tightens entity-card padding on ultra-narrow screens', () => {
    const narrow = mediaBlock(ux, '(max-width: 359px)');
    expect(narrow).toContain('[data-entity-card]');
    expect(narrow).toContain('padding: 0.75rem');
  });
});

describe('ux foundation / visual wave — ownership split', () => {
  it('keeps the structural file free of component ink', () => {
    // Structure never paints components. Comments and :root token definitions
    // are stripped first, then: no shadow, no text colour, no border colour, and
    // every remaining `background` must be a FilterTabs scroll-edge fade mask —
    // the only paint the structural layer legitimately owns.
    const declarations = withoutComments(ux)
      .replace(/:root\s*\{[\s\S]*?\}/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[a-z-]+\s*:/.test(line));
    const property = (line: string) => line.slice(0, line.indexOf(':')).trim();
    const value = (line: string) => line.slice(line.indexOf(':') + 1).trim();

    expect(declarations.filter((line) => property(line) === 'box-shadow')).toEqual([]);
    expect(declarations.filter((line) => property(line) === 'color')).toEqual([]);
    expect(declarations.filter((line) => property(line) === 'border-color')).toEqual([]);
    expect(declarations.filter((line) => property(line) === 'background').every((line) => value(line).startsWith('linear-gradient('))).toBe(true);
    expect(declarations.filter((line) => property(line) === 'background').length).toBeGreaterThan(0);
  });

  it('keeps !important reserved for what the cascade genuinely cannot reach', () => {
    // Only the mobile fullscreen dialog may force a value, because DialogContent
    // writes `transform` as an inline style. Every other override is settled by
    // layer status and source order instead of a shout.
    const flags = withoutComments(ux)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('!important'));
    expect(flags).toEqual(['transform: none !important;']);
    expect(wave).not.toMatch(/(color|background|box-shadow|border)[^;]*!important/);
  });

  it('makes the MALEK visual wave the final authority over the structural layer', () => {
    // Both files are unlayered, so source order decides equal-specificity ties.
    const globals = readFileSync(resolve(stylesDir, 'globals.css'), 'utf8');
    expect(globals.indexOf(" './ux-foundation.css'")).toBeGreaterThan(-1);
    expect(globals.indexOf(" './ux-foundation.css'")).toBeLessThan(
      globals.indexOf(" './malek-pro-visual-wave.css'"),
    );
  });
});
