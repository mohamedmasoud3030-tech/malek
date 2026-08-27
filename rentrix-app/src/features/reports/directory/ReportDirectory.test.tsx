import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportDirectory } from './ReportDirectory';

describe('ReportDirectory', () => {
  it('renders the seven operational report families, pinned reports, search, and direct shortcuts', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeSection="analytics"
        activeView="collections"
        onOpen={vi.fn()}
      />,
    );

    expect(html.match(/data-report-group=/g)).toHaveLength(7);
    expect(html).toContain('7 أقسام · 14 تقريرًا وكشفًا');
    expect(html).toContain('المفضلة والتقارير المثبتة');
    expect(html).toContain('بحث في مركز التقارير');
    expect(html).toContain('المالية والتحصيل');
    expect(html).toContain('التأجير والإشغال');
    expect(html).toContain('الصيانة والمرافق');
    expect(html).toContain('تقارير الملاك');
    expect(html).toContain('العقارات والوحدات');
    expect(html).toContain('التحليلات المتقدمة');
    expect(html).toContain('الرقابة والمطابقة');
    expect(html).toContain('مسير التحصيل');
    expect(html).toContain('المتأخرات والأرصدة');
    expect(html).toContain('انتهاء العقود والتجديد');
    expect(html).toContain('كشف حساب المالك');
    expect(html).toContain('تقرير الصيانة');
    expect(html).toContain('دفتر الأستاذ');
    expect(html).toContain('data-report-group="finance" data-active="true"');
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
});
