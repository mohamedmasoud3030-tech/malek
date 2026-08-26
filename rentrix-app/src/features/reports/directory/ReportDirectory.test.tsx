import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportDirectory } from './ReportDirectory';

describe('ReportDirectory', () => {
  it('renders the six report families and the direct report shortcuts without duplicating report bodies', () => {
    const html = renderToStaticMarkup(
      <ReportDirectory
        activeSection="analytics"
        activeView="collections"
        onOpen={vi.fn()}
      />,
    );

    expect(html.match(/data-report-group=/g)).toHaveLength(6);
    expect(html).toContain('6 مجموعات · 16 مدخل');
    expect(html).toContain('المالية والتحصيل');
    expect(html).toContain('العقود والإيجارات');
    expect(html).toContain('الملاك');
    expect(html).toContain('المستأجرون');
    expect(html).toContain('العقارات والوحدات');
    expect(html).toContain('الرقابة والمطابقة');
    expect(html).toContain('ملخص الأداء');
    expect(html).toContain('الإشغال والشواغر');
    expect(html).toContain('متأخرات المستأجرين');
    expect(html).toContain('دفتر الأستاذ');
    expect(html).toContain('تسوية الإيرادات');
    expect(html).toContain('data-report-group="finance" data-active="true"');
  });

  it('marks only the scoped statement family as active', () => {
    const ownerHtml = renderToStaticMarkup(
      <ReportDirectory
        activeSection="statements"
        activeView=""
        scope={{ ownerId: 'owner-1' }}
        onOpen={vi.fn()}
      />,
    );
    expect(ownerHtml).toContain('data-report-group="owners" data-active="true"');
    expect(ownerHtml).not.toContain('data-report-group="tenants" data-active="true"');

    const tenantHtml = renderToStaticMarkup(
      <ReportDirectory
        activeSection="statements"
        activeView=""
        scope={{ tenantId: 'tenant-1', contractId: 'contract-1' }}
        onOpen={vi.fn()}
      />,
    );
    expect(tenantHtml).toContain('data-report-group="tenants" data-active="true"');
    expect(tenantHtml).not.toContain('data-report-group="owners" data-active="true"');
  });
});
