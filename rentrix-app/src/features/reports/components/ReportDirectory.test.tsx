import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportDirectory } from './ReportDirectory';

describe('ReportDirectory', () => {
  it('renders the six report families without duplicating full report bodies', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeSection="analytics"
        activeView="collections"
        onOpen={vi.fn()}
      />,
    );

    expect(html.match(/data-report-group=/g)).toHaveLength(6);
    expect(html).toContain('المالية والتحصيل');
    expect(html).toContain('العقود والإيجارات');
    expect(html).toContain('الملاك');
    expect(html).toContain('المستأجرون');
    expect(html).toContain('العقارات والوحدات');
    expect(html).toContain('الرقابة والمطابقة');
    expect(html).toContain('مفتوح الآن');
  });
});
