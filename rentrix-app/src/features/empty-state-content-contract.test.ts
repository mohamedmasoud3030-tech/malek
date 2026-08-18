import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name) && !name.includes('.test.') && !name.includes('e2e') && !name.includes('fixture')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Guidance verbs that should appear in empty-state descriptions so the user
 * always knows what to do next instead of hitting a dead end.
 */
const GUIDANCE_VERBS = [
  'أضف', 'أضف', 'اضغط', 'ابدأ', 'أنشئ', 'أرسل', 'أدخل',
  'جرّب', 'اختر', 'غيّر', 'امسح', 'سجّل', 'حاول', 'شغّل',
  'يمكنك', 'راجع', 'تواصل', 'انقر',
  'إضافة', 'إنشاء', 'إرسال',
];

const PASSIVE_DESCRIPTION_PATTERN = /emptyDescription\s*=\s*(['"`])([^'"`]*)\1/;

/**
 * Description texts that are acceptable without a guidance verb.
 * These explain a specific circumstance (not-found, unavailable) rather than
 * representing an empty list that the user could act on.
 */
const ALLOWABLE_PASSIVE_PREFIXES = [
  'ربما', 'معرف', 'لم يتم العثور',
  'لا توجد فواتير متأخرة',  // factual statement (no overdue invoices)
];

/**
 * Future-promise marker: descriptions starting with "سيظهر" (will appear)
 * are acceptable because they promise future content.
 */
const FUTURE_PROMISE_MARKER = 'سيظهر';
const FUTURE_PROMISE_FEMININE = 'ستظهر';

/**
 * Filter-reference marker: descriptions mentioning "الفلاتر" (filters)
 * implicitly guide the user to change filters.
 */
const FILTER_MARKER = 'الفلاتر';

/**
 * Every empty-state description in EntityTable usage must guide the user
 * toward a next step rather than merely stating the absence of data.
 *
 * Patterns that pass:
 *   - "لا توجد عقود بعد. أنشئ أول عقد من زر «عقد جديد»."
 *   - "غيّر الفلاتر أو امسحها لعرض نتائج أخرى."
 *   - "أضف أول مصروف تشغيلي."
 *
 * Patterns that fail:
 *   - "لا توجد أحداث للعرض."
 *   - "لا توجد قواعد مطابقة للحالة الحالية."
 *   - "لم يرجع مصدر سجل التدقيق أي أحداث للعرض."
 */
describe('empty-state content contract', () => {
  const files = walk(srcRoot).filter((f) => f.includes(`${srcRoot}/features/`));

  const violations: { file: string; description: string }[] = [];

  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    const re = new RegExp(PASSIVE_DESCRIPTION_PATTERN, 'g');
    while ((match = re.exec(code)) !== null) {
      const description = match[2];
      const hasGuidance = GUIDANCE_VERBS.some((verb) => description.includes(verb));
      const hasFuturePromise = description.includes(FUTURE_PROMISE_MARKER);
      const isPassiveExplanation = ALLOWABLE_PASSIVE_PREFIXES.some((prefix) => description.startsWith(prefix));
      const hasFuturePromiseFeminine = description.includes(FUTURE_PROMISE_FEMININE);
      const mentionsFilters = description.includes(FILTER_MARKER);
      if (!hasGuidance && !hasFuturePromise && !hasFuturePromiseFeminine && !isPassiveExplanation && !mentionsFilters) {
        violations.push({
          file: file.replace(`${srcRoot}/`, ''),
          description,
        });
      }
    }
  }

  it('every empty-state description includes a guidance verb or future promise', () => {
    const message = violations
      .map((v) => `${v.file}: ${v.description}`)
      .join('\n');
    expect(violations, message).toEqual([]);
  });
});