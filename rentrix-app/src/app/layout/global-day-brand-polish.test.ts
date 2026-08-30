import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const pageLayout = readFileSync(resolve(layoutDir, '../../components/layout/page-layout.tsx'), 'utf8');
const pageHeader = readFileSync(resolve(layoutDir, '../../components/layout/page-header.tsx'), 'utf8');
const dashboardPage = readFileSync(resolve(layoutDir, '../../features/dashboard/dashboard-page.tsx'), 'utf8');
const routeTree = readFileSync(resolve(layoutDir, '../../app/router/route-tree.ts'), 'utf8');
const malikMark = readFileSync(resolve(layoutDir, '../../components/brand/malik-mark.tsx'), 'utf8');

describe('contextual day information and compact header brand contract', () => {
  it('keeps page identity canonical while day/date stays an explicit contextual option', () => {
    expect(pageHeader).toContain('data-global-page-context');
    expect(pageHeader).toContain('data-global-page-title');
    expect(pageHeader).toContain('showTodayContext?: boolean');
    expect(pageHeader).toContain('showTodayContext = false');
    expect(pageHeader).toContain('data-global-today-context');
    expect(pageHeader).toContain('data-global-today-weekday');
    expect(pageHeader).toContain('data-global-today-day-date');

    expect(pageLayout).not.toContain('data-global-page-context');
    expect(pageLayout).not.toContain('data-global-page-title');
    expect(pageLayout).not.toContain('data-global-day-label');
    expect(pageLayout).not.toContain('useMatches');
    expect(pageLayout).not.toContain('data-global-refresh');

    expect(routeTree).toContain("path: '/dashboard'");
    expect(routeTree).toContain("staticData: { title: 'لوحة التحكم' }");
  });

  it('keeps the dashboard header clean — no routine refresh action, no hero card, no forced day chrome', () => {
    expect(dashboardPage).not.toContain('HeroBanner');
    expect(dashboardPage).toContain('<PageHeader');
    expect(dashboardPage).toContain('title="لوحة التحكم"');
    expect(dashboardPage).not.toContain('showTodayContext');
    // The routine manual refresh button is gone; retry remains an error-state
    // affordance rendered by the shared ErrorState, not header chrome.
    expect(dashboardPage).not.toContain('primaryAction={(');
    expect(dashboardPage).not.toContain('آخر تحديث');
    expect(dashboardPage).not.toContain('data-dashboard-today-context');
  });

  it('keeps the canonical MALEK mark self-contained, sized by the lockup not a button group', () => {
    expect(malikMark).toContain('data-malek-canonical-mark');
    expect(malikMark).not.toContain('header-brand-monogram');
  });
});
