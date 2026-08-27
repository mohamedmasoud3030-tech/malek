import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RegisterMetricStrip } from './register-summary';

describe('RegisterMetricStrip desktop density', () => {
  it('uses all four desktop slots when exactly four useful metrics exist', () => {
    const html = renderToStaticMarkup(
      <RegisterMetricStrip
        aria-label="ملخص"
        items={[
          { id: 'a', label: 'أ', value: '1' }, { id: 'b', label: 'ب', value: '2' },
          { id: 'c', label: 'ج', value: '3' }, { id: 'd', label: 'د', value: '4' },
        ]}
      />,
    );
    expect(html).toContain('data-desktop-columns="4"');
  });

  it('does not reserve a card for metrics deliberately hidden at zero', () => {
    const html = renderToStaticMarkup(
      <RegisterMetricStrip aria-label="ملخص" items={[{ id: 'empty', label: 'صفر', value: '0', hideWhenEmpty: true }]} />,
    );
    expect(html).toBe('');
  });
});
