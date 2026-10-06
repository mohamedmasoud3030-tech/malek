// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import {
  DistributionStrip,
  MiniBarsCompare,
  ProgressMeter,
  RadialMetric,
  TrendDelta,
} from './dashboard-visuals';

function render(node: React.ReactNode): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return container;
}

describe('dashboard visualization vocabulary', () => {
  it('keeps the radial value textual as well as visual and clamps impossible percentages', () => {
    const container = render(<RadialMetric percent={140} label="نسبة الإشغال" />);
    expect(container.textContent).toContain('100%');
    const negative = render(<RadialMetric percent={-5} label="نسبة الإشغال" />);
    expect(negative.textContent).toContain('0%');
  });

  it('exposes progress values through a progressbar role with the textual value beside it', () => {
    const container = render(<ProgressMeter percent={87.7} label="نسبة التحصيل" valueText="87.7%" />);
    const meter = container.querySelector('[role="progressbar"]');
    expect(meter?.getAttribute('aria-valuenow')).toBe('88');
    expect(container.textContent).toContain('87.7%');
  });

  it('renders comparison bars with their numeric text alongside the visual', () => {
    const container = render(
      <MiniBarsCompare
        items={[
          { label: 'المحصّل', value: 18420, displayValue: '18,420 OMR', barClass: 'bg-success' },
          { label: 'المصروفات', value: 2100, displayValue: '2,100 OMR', barClass: 'bg-danger' },
        ]}
      />,
    );
    expect(container.textContent).toContain('18,420 OMR');
    expect(container.textContent).toContain('2,100 OMR');
  });

  it('keeps distribution segments explained by a textual legend', () => {
    const container = render(
      <DistributionStrip
        label="أعمار الشغور"
        total={4}
        segments={[
          { key: 'a', label: '0–15 يوم', count: 1, barClass: 'bg-info' },
          { key: 'b', label: '+60 يوم', count: 3, barClass: 'bg-danger' },
        ]}
      />,
    );
    expect(container.textContent).toContain('0–15 يوم');
    expect(container.textContent).toContain('+60 يوم');
    expect(container.textContent).toContain('3');
  });

  it('marks trend direction accessibly', () => {
    const container = render(<TrendDelta direction="down" tone="danger" text="18%" />);
    const delta = container.querySelector('[data-dashboard-trend-delta]');
    expect(delta?.textContent).toContain('↓');
    expect(delta?.textContent).toContain('18%');
  });
});
