import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportDirectory } from './ReportDirectory';

describe('ReportDirectory', () => {
  it('renders the six business workspaces plus the secondary specialist review, with search and pinned reports', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeWorkspace="collections"
        activeView="collections"
        onOpen={vi.fn()}
      />,
    );

    expect(html.match(/data-report-group=/g)).toHaveLength(7);
    expect(html).toContain('بحث في مركز التقارير');
    expect(html).toContain('الأكثر استخدامًا');
    // Scope filter is a shared FilterTabs toggle group (aria-pressed buttons),
    // not a tablist.
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="مجالات التقارير"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('أداء المكتب');
    expect(html).toContain('التحصيل والمتأخرات');
    expect(html).toContain('العقود والإشغال');
    expect(html).toContain('التشغيل والمصروفات');
    expect(html).toContain('العقارات والوحدات');
    expect(html).toContain('الكشوف');
    expect(html).toContain('المراجعة المالية');
    expect(html).toContain('data-report-group="collections" data-active="true"');
  });

  it('renders the specialist review visually secondary and labelled for specialists', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeWorkspace="office"
        activeView="overview"
        onOpen={vi.fn()}
      />,
    );

    expect(html).toContain('data-report-specialist-groups');
    expect(html).toContain('للمختصين');
    expect(html).toContain('data-specialist="true"');
  });

  it('marks the statements workspace active when a statements view is open', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeWorkspace="statements"
        activeView=""
        onOpen={vi.fn()}
      />,
    );

    expect(html).toContain('data-report-group="statements" data-active="true"');
  });

  it('keeps all shortcut destinations selectable regardless of the active report', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeWorkspace="office"
        activeView="overview"
        onOpen={vi.fn()}
      />,
    );

    expect(html).toContain('ملخص الفترة');
    expect(html).toContain('المتأخرات');
    expect(html).toContain('المصروفات');
    expect(html).toContain('كشف المالك');
    expect(html).toContain('الصيانة');
    expect(html).toContain('المتابعة');
    expect(html).toContain('العقود القريبة من الانتهاء');
  });
});
