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

describe('shared day context and compact header brand contract', () => {
  it('keeps page identity and day/date in the single canonical PageHeader', () => {
    expect(pageHeader).toContain('data-global-page-context');
    expect(pageHeader).toContain('data-global-page-title');
    expect(pageHeader).toContain('data-global-day-label');
    expect(pageHeader).toContain("todayLabel: isArabic ? 'اليوم' : 'Today'");
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

  it('keeps dashboard freshness as the PageHeader primary action without restoring a hero card', () => {
    expect(dashboardPage).not.toContain('HeroBanner');
    expect(dashboardPage).toContain('<PageHeader');
    expect(dashboardPage).toContain('primaryAction={(');
    expect(dashboardPage).toContain('onClick={retryDashboard}');
    expect(dashboardPage).not.toContain('آخر تحديث');
    expect(dashboardPage).not.toContain('data-dashboard-today-context');
  });

  it('lets the canonical MALEK mark fill the compact header button', () => {
    expect(malikMark).toContain('group-data-[header-brand-monogram]:size-7');
    expect(malikMark).toContain('data-malek-canonical-mark');
  });
});
