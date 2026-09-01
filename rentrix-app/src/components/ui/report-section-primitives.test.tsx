import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportDrillAction } from './report-section-primitives';

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
