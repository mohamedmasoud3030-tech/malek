import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'src/features/reports');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('Reports mobile UX contract', () => {
  it('keeps analytical report headers from squeezing Arabic titles beside actions', () => {
    const source = read('premium/report-product-page.tsx');
    expect(source).toContain('flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between');
    expect(source).toContain('w-full min-w-0 sm:w-auto sm:max-w-full');
    expect(source).toContain('data-report-product-actions');
  });

  it('gives statement actions the full phone width while retaining desktop sizing', () => {
    const source = read('premium/statement-product-header.tsx');
    expect(source).toContain('w-full min-w-0 sm:w-auto sm:max-w-full');
    expect(source).toContain('data-statement-product-actions');
  });

  it('keeps report summary metrics horizontally usable instead of shrinking values into unreadable columns', () => {
    const source = read('../../components/ui/report-section-primitives.tsx');
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('overscroll-x-contain');
    expect(source).toContain('min-w-max shrink-0');
  });

  it('keeps report navigation horizontally scrollable on narrow viewports', () => {
    const source = read('../../components/ui/section-tabs.tsx');
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('shrink-0');
    expect(source).toContain('min-h-11');
  });
  it('stacks general-ledger workspace headers on phones so status badges do not squeeze titles', () => {
    const source = read('components/GeneralLedgerCoreSection.tsx');
    expect(source).toContain('flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between');
    expect(source).not.toContain('flex items-center justify-between gap-3');
  });

  it('uses a single-column payload KPI layout on phones before expanding on larger screens', () => {
    const source = read('components/report-payload-groups.tsx');
    expect(source).toContain('grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4');
  });

});
