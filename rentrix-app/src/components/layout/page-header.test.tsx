import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PageHeader } from './page-header';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: Readonly<{ children: React.ReactNode; to: string }>) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

describe('PageHeader — العنوان الموحد للصفحات', () => {
  it('renders the title inside a single h1 landmark', () => {
    const html = renderToStaticMarkup(<PageHeader title="العقود" />);
    expect(html).toContain('<h1');
    expect(html).toContain('العقود');
    expect(html).toContain('data-page-header');
  });

  it('keeps routine page headers focused instead of repeating the day on every screen', () => {
    const html = renderToStaticMarkup(<PageHeader title="العقود" />);
    expect(html).not.toContain('data-global-today-context');
    expect(html).not.toContain('data-global-today-weekday');
  });

  it('renders day context only when the owning workflow explicitly asks for it', () => {
    const html = renderToStaticMarkup(<PageHeader title="عمل اليوم" showTodayContext />);
    expect(html).toContain('data-global-today-context');
    expect(html).toContain('data-global-today-weekday');
    expect(html).toContain('data-global-today-day-date');
  });

  it('renders the record count badge with an accessible label', () => {
    const html = renderToStaticMarkup(<PageHeader title="العقارات" count={42} />);
    expect(html).toContain('42');
    expect(html).toContain('عدد السجلات 42');
    expect(html).toContain('tabular-nums');
  });

  it('renders primary and secondary actions', () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="العقود"
        primaryAction={<button type="button">إنشاء عقد</button>}
        secondaryActions={<button type="button">تصدير CSV</button>}
      />,
    );
    expect(html).toContain('إنشاء عقد');
    expect(html).toContain('تصدير CSV');
    expect(html).toContain('إجراءات ثانوية');
  });

  it('keeps the actions rail mobile-aware: primary compact visible, secondary in overflow on mobile', () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="العقود"
        primaryAction={<button type="button">إنشاء عقد</button>}
        secondaryActions={<button type="button">تصدير CSV</button>}
      />,
    );
    expect(html).toContain('إنشاء عقد');
    expect(html).toContain('إجراءات إضافية');
    expect(html).toContain('data-secondary-overflow-trigger');
    expect(html).not.toContain('max-w-[58vw]');
    expect(html).not.toContain('overflow-x-auto');
    expect(html).toContain('flex-wrap');
    expect(html).toContain('[overflow-wrap:anywhere]');
  });

  it('groups secondary actions without broken menus and preserves accessible names', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="العقود" secondaryActions={<button type="button">تصدير CSV</button>} />,
    );
    expect(html).toContain('تصدير CSV');
    expect(html).toContain('aria-label="إجراءات إضافية"');
    expect(html).not.toContain('class="contents"');
  });

  it('renders the canonical primary action without a compatibility fallback', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="x" primaryAction={<i>جديد</i>} />,
    );
    expect(html).toContain('جديد');
  });

  it('renders a back link whose arrow flips in RTL', () => {
    const html = renderToStaticMarkup(<PageHeader title="تفاصيل" backTo="/properties" />);
    expect(html).toContain('href="/properties"');
    expect(html).toContain('rtl:rotate-180');
    expect(html).toContain('رجوع');
  });

  it('omits the actions region entirely when nothing is actionable', () => {
    const html = renderToStaticMarkup(<PageHeader title="هادئة" description="بدون إجراءات" />);
    expect(html).toContain('بدون إجراءات');
    expect(html).not.toContain('إجراءات ثانوية');
  });
});
