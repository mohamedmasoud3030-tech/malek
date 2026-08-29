import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportDirectory } from './ReportDirectory';

describe('ReportDirectory', () => {
  it('renders the six decision-first report families, pinned reports, search, and direct shortcuts', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeSection="analytics"
        activeView="collections"
        onOpen={vi.fn()}
      />,
    );

    expect(html.match(/data-report-group=/g)).toHaveLength(6);
    expect(html).toContain('بحث في مركز التقارير');
    expect(html).toContain('الأكثر استخدامًا');
    expect(html).toContain("role=\"tablist\"");
    expect(html).toContain('أداء المكتب');
    expect(html).toContain('التحصيل والمتأخرات');
    expect(html).toContain('العقود والإشغال');
    expect(html).toContain('المصروفات والصيانة');
    expect(html).toContain('الملاك والمستأجرون');
    expect(html).toContain('العقارات والوحدات');
    expect(html).toContain('data-report-group="collections" data-active="true"');
  });

  it('marks the owner family active when an owner statement scope is open', () => {
    const ownerHtml = renderToStaticMarkup(
      <ReportDirectory
        activeSection="statements"
        activeView=""
        scope={{ ownerId: 'owner-1' }}
        onOpen={vi.fn()}
      />,
    );

    expect(ownerHtml).toContain('data-report-group="owners" data-active="true"');
  });

  it('keeps all shortcut destinations selectable regardless of the active report', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeSection="analytics"
        activeView="overview"
        onOpen={vi.fn()}
      />,
    );

    expect(html).toContain('التحصيل');
    expect(html).toContain('المتأخرات');
    expect(html).toContain('المصروفات');
    expect(html).toContain('كشف المالك');
    expect(html).toContain('الصيانة');
  });
});
