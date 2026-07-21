import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * UX foundation contract — يحمي قواعد سطح الهاتف التي يصعب التقاطها بوحدات المكوّنات:
 *
 * 1. ارتفاع شريط التنقل السفلي هو متغير مركزي واحد (--mobile-bottom-nav-height)
 *    ومساحة التحرُّر أسفل الصفحة مشتقة منه (لا أرقام سحرية مكررة).
 * 2. حالات الضغط (press/anti-ghost-hover) محصورة في أجهزة لمس حقيقية
 *    (hover: none) وإلا أجهزة اللابتوب الهجينة تفقد حالات hover الحقيقية بالماوس.
 * 3. توهُّجات أطراف FilterTabs لا تظهر أبدًا أثناء وجود تركيز لوحة المفاتيح
 *    داخل الممر (وإلا أخفت حلقات التركيز على الألسنة الطرفية).
 * 4. حارس تكبير الإدخال في iOS محصور بعرض الهاتف فقط — iPad/الأسطح الأوسع
 *    تحتفظ بأحجام خطوط المكوّنات.
 * 5. الشاشات الضيقة جدًا (≤359px) تُقلّص حشوة بطاقات الكيانات.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const ux = readFileSync(resolve(stylesDir, 'ux-foundation.css'), 'utf8');

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
    expect(ux).toContain('--mobile-bottom-nav-height: 3.75rem');
    const clearance = mediaBlock(ux, '(max-width: 1023px)');
    expect(clearance).toContain('var(--mobile-bottom-nav-height)');
    expect(clearance).toContain('env(safe-area-inset-bottom');
    expect(clearance).not.toContain('calc(4.5rem');
  });

  it('scopes press states and the ghost-hover guard to true touch devices (hover: none)', () => {
    const block = mediaBlock(ux, '(hover: none) and (pointer: coarse)');
    expect(block).toContain('[data-entity-card]:active');
    expect(block).toContain(':hover:not(:active)');
  });

  it('never applies the press/ghost-hover overrides to hybrid pointer devices', () => {
    const unguarded = mediaBlock(ux, '(pointer: coarse) {');
    expect(unguarded).not.toContain(':hover:not(:active)');
    expect(unguarded).not.toContain('[data-entity-card]:active');
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
