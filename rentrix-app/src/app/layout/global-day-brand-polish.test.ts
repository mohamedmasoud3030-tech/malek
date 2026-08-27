import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const pageLayout = readFileSync(resolve(layoutDir, '../../components/layout/page-layout.tsx'), 'utf8');
const dashboardPage = readFileSync(resolve(layoutDir, '../../features/dashboard/dashboard-page.tsx'), 'utf8');
const malikMark = readFileSync(resolve(layoutDir, '../../components/brand/malik-mark.tsx'), 'utf8');
const appShell = readFileSync(resolve(layoutDir, '../../app/layout/app-shell.tsx'), 'utf8');
const uxFoundation = readFileSync(resolve(layoutDir, '../../styles/ux-foundation.css'), 'utf8');

describe('global day context and compact header brand contract', () => {
  it('keeps one shared sticky day/date context across page layouts', () => {
    expect(pageLayout).toContain('data-global-today-context');
    // The strip must offset by the SAME token that sizes the sticky header, so
    // the two can never drift apart and the strip can never slide under it.
    expect(pageLayout).toContain('top-[calc(var(--app-header-height,3rem)+env(safe-area-inset-top,0px))]');
    expect(appShell).toContain('min-h-[var(--app-header-height)]');
    expect(uxFoundation).toContain('--app-header-height: 3rem');
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
