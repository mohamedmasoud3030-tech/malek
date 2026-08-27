import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dashboardDir = resolve(dirname(fileURLToPath(import.meta.url)));
const page = readFileSync(resolve(dashboardDir, 'dashboard-page.tsx'), 'utf8');
const kpiGrid = readFileSync(resolve(dashboardDir, 'components/kpi-grid.tsx'), 'utf8');

describe('dashboard desktop workspace contract', () => {
  it('uses the wide workspace instead of leaving the command center constrained', () => {
    expect(page).toContain('<PageLayout size="wide"');
  });

  it('keeps the four money and obligation signals visible in one desktop row', () => {
    expect(kpiGrid).toContain('<ResponsiveCardGrid desktopColumns={4}');
  });
});
