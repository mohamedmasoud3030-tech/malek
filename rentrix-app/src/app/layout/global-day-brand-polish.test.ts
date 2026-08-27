import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const pageLayout = readFileSync(resolve(layoutDir, '../../components/layout/page-layout.tsx'), 'utf8');
const dashboardPage = readFileSync(resolve(layoutDir, '../../features/dashboard/dashboard-page.tsx'), 'utf8');
const routeTree = readFileSync(resolve(layoutDir, '../../app/router/route-tree.ts'), 'utf8');
const malikMark = readFileSync(resolve(layoutDir, '../../components/brand/malik-mark.tsx'), 'utf8');

describe('shared page/date context and compact header brand contract', () => {
  it('keeps the date bar in normal document flow and changes only the page name', () => {
    expect(pageLayout).toContain('data-global-page-context');
    expect(pageLayout).toContain('data-global-page-title');
    expect(pageLayout).toContain('const matches = useMatches()');
    expect(pageLayout).toContain('title?.trim() || routeTitle || APP_BRAND_NAME');
    expect(pageLayout).not.toContain('className="sticky');
    expect(pageLayout).not.toContain('top-[calc(var(--app-header-height');
    expect(pageLayout).not.toContain('z-20 mx-3');
    expect(pageLayout).toContain('data-global-today-weekday');
    expect(pageLayout).toContain('data-global-today-day-date');
    expect(routeTree).toContain("path: '/dashboard'");
    expect(routeTree).toContain("staticData: { title: 'لوحة التحكم' }");
  });

  it('keeps the dashboard freshness action without restoring a duplicate hero card', () => {
    expect(dashboardPage).not.toContain('HeroBanner');
    expect(pageLayout).toContain('data-global-refresh');
    expect(dashboardPage).toContain('onRefresh={retryDashboard}');
    expect(dashboardPage).not.toContain('آخر تحديث');
    expect(dashboardPage).not.toContain('data-dashboard-today-context');
  });

  it('lets the canonical MALEK mark fill the compact header button', () => {
    expect(malikMark).toContain('group-data-[header-brand-monogram]:size-7');
  });
});
