import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const pageLayout = readFileSync(resolve(layoutDir, '../../components/layout/page-layout.tsx'), 'utf8');
const dashboardPage = readFileSync(resolve(layoutDir, '../../features/dashboard/dashboard-page.tsx'), 'utf8');
const malikMark = readFileSync(resolve(layoutDir, '../../components/brand/malik-mark.tsx'), 'utf8');

describe('global day context and compact header brand contract', () => {
  it('keeps one shared sticky day/date context across page layouts', () => {
    expect(pageLayout).toContain('data-global-today-context');
    expect(pageLayout).toContain('sticky top-[calc(3rem+env(safe-area-inset-top,0px))]');
    expect(pageLayout).toContain('data-global-today-weekday');
    expect(pageLayout).toContain('data-global-today-day-date');
  });

  it('keeps the dashboard-only freshness and overflow card removed', () => {
    // The compatibility stub completed its phase-out: the dashboard no longer
    // renders any hero/freshness card, and day context stays in the shared strip.
    expect(dashboardPage).not.toContain('HeroBanner');
    expect(pageLayout).toContain('data-global-refresh');
    expect(dashboardPage).toContain('onRefresh={retryDashboard}');
    expect(dashboardPage).not.toContain('آخر تحديث');
    expect(dashboardPage).not.toContain('data-dashboard-today-context');
  });

  it('lets the M mark fill the compact header button instead of looking undersized', () => {
    expect(malikMark).toContain('group-data-[header-brand-monogram]:size-7');
  });
});
