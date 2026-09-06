import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportDrillAction, ReportProgress, ReportState, ReportSummaryStrip } from './report-section-primitives';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/ui/report-section-primitives.tsx'),
  'utf8',
);

describe('ReportDrillAction — the one report drill-through affordance', () => {
  it('renders the canonical MALEK button with a 44px touch target', () => {
    const markup = renderToStaticMarkup(
      <ReportDrillAction label="المتأخرات والأعمار" onClick={vi.fn()} />,
    );

    expect(markup).toContain('المتأخرات والأعمار');
    expect(markup).toContain('data-report-drill');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('type="button"');
    expect(markup).not.toMatch(/min-h-(8|9|10)\b/);
  });

  it('supports an in-row ghost affordance with an explicit accessible name', () => {
    const markup = renderToStaticMarkup(
      <ReportDrillAction label="فتح" variant="ghost" ariaLabel="فتح متابعة المتأخرات" onClick={vi.fn()} />,
    );

    expect(markup).toContain('aria-label="فتح متابعة المتأخرات"');
    expect(markup).toContain('min-h-11');
  });

  it('can be disabled without losing the canonical button semantics', () => {
    const markup = renderToStaticMarkup(
      <ReportDrillAction label="فتح" onClick={vi.fn()} disabled />,
    );

    expect(markup).toContain('disabled=""');
  });

  it('builds on the shared Button rather than re-implementing one', () => {
    expect(source).toContain("import { Button } from '@/components/ui/button'");
    expect(source).toContain('export function ReportDrillAction');
    // Scoped to the drill affordance itself: this file is the canonical home
    // for report primitives, and `ReportSegmentedTabs` legitimately owns a
    // native tab element with `role="tab"` semantics Button does not provide.
    const drillAction = source.slice(source.indexOf('export function ReportDrillAction'));
    const drillBody = drillAction.slice(0, drillAction.indexOf('\nexport '));
    expect(drillBody).not.toMatch(/<button[\s>]/);
  });

  it('stays a routing primitive and never formats or computes a figure', () => {
    const drillBlock = source.slice(source.indexOf('export function ReportDrillAction'));
    const body = drillBlock.slice(0, drillBlock.indexOf('\n}\n') + 3);

    expect(body).not.toContain('formatMoney');
    expect(body).not.toContain('formatLatinNumber');
    expect(body).not.toMatch(/toFixed|Math\.round|\/ 100/);
  });
});

describe('Report primitives — distinct loading state', () => {
  it('ReportSummaryStrip renders values by default and skeletons while loading', () => {
    const items = [
      { label: 'إجمالي', value: '1,000', detail: 'مصدر معتمد' },
      { label: 'متأخر', value: '250', detail: 'فواتير مفتوحة' },
    ];

    const ready = renderToStaticMarkup(<ReportSummaryStrip dataReportSummary="test" items={items} />);
    expect(ready).toContain('data-report-summary="test"');
    expect(ready).toContain('1,000');
    expect(ready).toContain('مصدر معتمد');
    expect(ready).not.toContain('جارٍ تحميل ملخص التقرير');

    const loading = renderToStaticMarkup(<ReportSummaryStrip dataReportSummary="test" items={items} isLoading />);
    expect(loading).not.toContain('1,000');
    expect(loading).not.toContain('250');
    expect(loading).not.toContain('مصدر معتمد');
    expect(loading).toContain('role="status"');
    expect(loading).toContain('جارٍ تحميل ملخص التقرير');
  });

  it('ReportProgress renders the bounded percentage by default and skeletons while loading', () => {
    const ready = renderToStaticMarkup(<ReportProgress label="نسبة التحصيل" value={75.6} helper="مساعدة" />);
    expect(ready).toContain('76%');
    expect(ready).toContain('نسبة التحصيل');
    expect(ready).toContain('مساعدة');

    const loading = renderToStaticMarkup(<ReportProgress label="نسبة التحصيل" value={75.6} helper="مساعدة" isLoading />);
    expect(loading).not.toContain('76%');
    expect(loading).not.toContain('مساعدة');
    expect(loading).toContain('role="status"');
    expect(loading).toContain('جارٍ تحميل نسبة التحصيل');
  });

  it('ReportState keeps empty/error copy by default and renders a skeleton while loading', () => {
    const ready = renderToStaticMarkup(
      <ReportState kind="error" title="غير متاح" message="تعذر التحميل" />,
    );
    expect(ready).toContain('غير متاح');
    expect(ready).toContain('تعذر التحميل');
    expect(ready).toContain('role="alert"');

    const loading = renderToStaticMarkup(
      <ReportState kind="error" title="جارٍ تحميل البيانات" message="تعذر التحميل" isLoading />,
    );
    expect(loading).not.toContain('تعذر التحميل');
    expect(loading).toContain('role="status"');
    expect(loading).toContain('جارٍ تحميل البيانات');
  });
});
