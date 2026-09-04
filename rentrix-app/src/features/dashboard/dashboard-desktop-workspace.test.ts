import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dashboardDir = resolve(dirname(fileURLToPath(import.meta.url)));
const page = readFileSync(resolve(dashboardDir, 'dashboard-page.tsx'), 'utf8');
const officePulse = readFileSync(resolve(dashboardDir, 'components/office-pulse.tsx'), 'utf8');

describe('dashboard desktop workspace contract', () => {
  it('uses the wide workspace instead of leaving the command center constrained', () => {
    expect(page).toContain('<PageLayout size="wide"');
  });

  it('keeps the four Office Pulse surfaces in one bounded desktop row', () => {
    expect(officePulse).toContain('<ResponsiveCardGrid gap="sm" aria-label="نبض المكتب" desktopColumns={4}');
    expect(page).toContain('sectionId="office-pulse"');
  });

  it('lays the command center out on the intentional 12-column desktop grid', () => {
    expect(page).toContain('xl:grid-cols-12');
    expect(page).toContain('xl:col-span-7');
    expect(page).toContain('xl:col-span-5');
    // Closing row is the full-width office performance panel; the retired
    // owner-obligations closing section must stay removed.
    expect(page).toContain('sectionId="financial-performance"');
    expect(page).not.toContain('data-dashboard-closing-row');
  });

  it('does not repeat section titles when the inner signal panel already owns the heading', () => {
    expect(page).toContain('showHeader={false}');
    expect(page).not.toContain('<h2 className="sr-only">{title}</h2>');
    expect(page).toContain('sectionId="office-pulse"');
  });
});
