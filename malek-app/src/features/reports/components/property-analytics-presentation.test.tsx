// @vitest-environment happy-dom
/**
 * Property Analytics presentation contract.
 *
 * Locks the decision-usefulness of the workspace: an executive strip that can
 * say "unavailable", a deterministic comparison, a portfolio benchmark, and
 * insight sentences — none of which may invent a number or publish a fake zero.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PropertyAnalyticsSection } from './PropertyAnalyticsSection';
import type { OccupancyChartRow } from '../reports-page.helpers';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => ({ companySettings: { companyName: 'شركة', currency: 'OMR', documentPrefixes: {} }, isReady: true }),
}));
vi.mock('@/services/documents/DocumentService', () => ({
  documentService: { printDocument: vi.fn(), downloadDocumentPdf: vi.fn() },
}));

const occupancyRows: OccupancyChartRow[] = [
  { property: 'برج الخوير', propertyId: 'p1', shortPropertyId: '', hasTitle: true, occupied: 6, vacant: 2, nonRentable: 2 },
  { property: 'مجمع الموالح', propertyId: 'p2', shortPropertyId: '', hasTitle: true, occupied: 8, vacant: 2, nonRentable: 0 },
];

afterEach(() => cleanup());

describe('Property Analytics presentation', () => {
  it('renders an em dash rather than zero when a metric source is unavailable', () => {
    render(
      <PropertyAnalyticsSection
        occupancyRows={[]}
        expenseRows={[]}
        performanceRows={[]}
        isLoading={false}
        onDrill={() => undefined}
      />,
    );
    const strip = document.querySelector('[data-report-summary="property-analytics"]')!;
    // Occupancy, collections, overdue and expenses have no source here.
    expect(within(strip as HTMLElement).getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(within(strip as HTMLElement).queryByText('0%')).toBeNull();
  });

  it('shows the three-way occupancy scope without calling non-rentable stock vacant', () => {
    render(
      <PropertyAnalyticsSection
        occupancyRows={occupancyRows}
        expenseRows={[]}
        performanceRows={[]}
        isLoading={false}
        onDrill={() => undefined}
      />,
    );
    expect(screen.getAllByText(/غير قابلة للتأجير/).length).toBeGreaterThan(0);
    expect(screen.getByText('وحدات شاغرة')).toBeDefined();
  });

  it('renders the comparison with percentage points for rates and amounts for money', () => {
    render(
      <PropertyAnalyticsSection
        occupancyRows={occupancyRows}
        expenseRows={[]}
        performanceRows={[]}
        isLoading={false}
        onDrill={() => undefined}
        comparison={[
          { key: 'occupancy', label: 'نسبة الإشغال', kind: 'rate', current: 70, previous: 80, change: -10, direction: 'down', higherIsBetter: true },
          { key: 'collected', label: 'المحصل للفترة', kind: 'amount', current: 1200, previous: 1000, change: 200, direction: 'up', higherIsBetter: true },
          { key: 'expenses', label: 'المصروفات المسجلة', kind: 'amount', current: null, previous: 1000, change: null, direction: null, higherIsBetter: false },
        ]}
        previousPeriod={{ from: '2026-01-01', to: '2026-01-31' }}
      />,
    );
    expect(screen.getByText('ما الذي تغيّر؟')).toBeDefined();
    expect(screen.getByText('-10 نقطة')).toBeDefined();
    // An unavailable change is an em dash, not "0".
    expect(screen.getAllByText('المصروفات المسجلة').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('omits the comparison panel entirely when there is no previous period', () => {
    render(
      <PropertyAnalyticsSection
        occupancyRows={occupancyRows}
        expenseRows={[]}
        performanceRows={[]}
        isLoading={false}
        onDrill={() => undefined}
        comparison={[]}
      />,
    );
    expect(screen.queryByText('ما الذي تغيّر؟')).toBeNull();
  });

  it('shows the portfolio benchmark only when the scope supports it', () => {
    render(
      <PropertyAnalyticsSection
        occupancyRows={occupancyRows}
        expenseRows={[]}
        performanceRows={[]}
        isLoading={false}
        onDrill={() => undefined}
        benchmark={[{ key: 'occupancy', label: 'نسبة الإشغال', kind: 'rate', property: 60, portfolio: 80 }]}
      />,
    );
    expect(screen.getByText('العقار مقابل بقية المحفظة')).toBeDefined();
  });

  it('states the operational nature of the priority ordering and vacancy reference value', () => {
    render(
      <PropertyAnalyticsSection
        occupancyRows={occupancyRows}
        expenseRows={[]}
        performanceRows={[]}
        isLoading={false}
        onDrill={() => undefined}
      />,
    );
    expect(screen.getByText(/ترتيب تشغيلي/)).toBeDefined();
    expect(screen.getByText(/ليست إيرادًا ولا ذمة مدينة/)).toBeDefined();
  });

  it('keeps every drill affordance on the canonical primitive with a 44px target', () => {
    render(
      <PropertyAnalyticsSection
        occupancyRows={occupancyRows}
        expenseRows={[]}
        performanceRows={[]}
        isLoading={false}
        onDrill={() => undefined}
      />,
    );
    const drills = Array.from(document.querySelectorAll('[data-report-drill]'));
    expect(drills.length).toBeGreaterThan(0);
    for (const drill of drills) {
      expect(drill.className).toContain('min-h-11');
    }
  });
});
