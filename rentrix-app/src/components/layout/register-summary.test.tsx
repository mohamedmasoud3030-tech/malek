import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RegisterMetricStrip } from './register-summary';

describe('RegisterMetricStrip human density', () => {
  it('renders useful metrics inside one shared responsive facts surface', () => {
    const html = renderToStaticMarkup(
      <RegisterMetricStrip
        aria-label="ملخص"
        items={[
          { id: 'a', label: 'أ', value: '1' },
          { id: 'b', label: 'ب', value: '2' },
          { id: 'c', label: 'ج', value: '3' },
          { id: 'd', label: 'د', value: '4' },
        ]}
      />,
    );
    expect(html).toContain('data-register-metric-strip');
    expect(html.match(/data-register-metric=""/g)).toHaveLength(4);
    expect(html).toContain('grid-cols-2');
    expect(html).toContain('gap-px');
    expect(html).not.toContain('data-desktop-columns');
    expect(html).not.toContain('shadow-card');
  });

  it('does not reserve a visual slot for metrics deliberately hidden at zero', () => {
    const html = renderToStaticMarkup(
      <RegisterMetricStrip aria-label="ملخص" items={[{ id: 'empty', label: 'صفر', value: '0', hideWhenEmpty: true }]} />,
    );
    expect(html).toBe('');
  });
});
