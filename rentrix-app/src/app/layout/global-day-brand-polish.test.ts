import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layoutDir = resolve(dirname(fileURLToPath(import.meta.url)));
const pageLayout = readFileSync(resolve(layoutDir, '../../components/layout/page-layout.tsx'), 'utf8');
const heroBanner = readFileSync(resolve(layoutDir, '../../features/dashboard/components/hero-banner.tsx'), 'utf8');
const malikMark = readFileSync(resolve(layoutDir, '../../components/brand/malik-mark.tsx'), 'utf8');

describe('global day context and compact header brand contract', () => {
  it('keeps one shared sticky day/date context across page layouts', () => {
    expect(pageLayout).toContain('data-global-today-context');
    expect(pageLayout).toContain('sticky top-[calc(3rem+env(safe-area-inset-top,0px))]');
    expect(pageLayout).toContain('data-global-today-weekday');
    expect(pageLayout).toContain('data-global-today-day-date');
  });

  it('removes the dashboard-only freshness and overflow card', () => {
    expect(heroBanner).toContain('return null');
    expect(heroBanner).not.toContain('MoreVertical');
    expect(heroBanner).not.toContain('آخر تحديث');
    expect(heroBanner).not.toContain('خيارات اليوم');
  });

  it('lets the M mark fill the compact header button instead of looking undersized', () => {
    expect(malikMark).toContain('group-data-[header-brand-monogram]:size-7');
  });
});
