import { renderToStaticMarkup } from 'react-dom/server';
import { Building2, CircleGauge } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { OperationalCommandPanel, OperationalMetricCard } from './operational-summary';

describe('operational summary primitives', () => {
  it('renders one reusable metric card with semantic content', () => {
    const html = renderToStaticMarkup(
      <OperationalMetricCard
        label="إجمالي العقارات"
        value="12"
        hint="كل النتائج المطابقة"
        icon={Building2}
      />,
    );

    expect(html).toContain('data-operational-metric');
    expect(html).toContain('إجمالي العقارات');
    expect(html).toContain('>12<');
    expect(html).toContain('كل النتائج المطابقة');
  });

  it('normalizes command progress and preserves footer details', () => {
    const html = renderToStaticMarkup(
      <OperationalCommandPanel
        label="معدل الإشغال"
        value="82%"
        icon={CircleGauge}
        progress={140}
        footer={<><span>8 مشغولة</span><span>2 متاحة</span></>}
      />,
    );

    expect(html).toContain('data-operational-command');
    expect(html).toContain('width:100%');
    expect(html).toContain('8 مشغولة');
    expect(html).toContain('2 متاحة');
  });

  it('supports warning/destructive treatment without raw dynamic classes', () => {
    const html = renderToStaticMarkup(
      <OperationalCommandPanel
        label="طلبات عاجلة"
        value="3"
        icon={CircleGauge}
        tone="destructive"
        description="تحتاج متابعة فورية"
      />,
    );

    expect(html).toContain('bg-destructive/20');
    expect(html).toContain('text-destructive');
    expect(html).toContain('تحتاج متابعة فورية');
  });
});
