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

  it('keeps the actions rail constrained and scrollable on mobile, wrapping from sm up', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="العقود" primaryAction={<button type="button">إنشاء عقد</button>} />,
    );
    expect(html).toContain('max-w-[58vw]');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('sm:flex-wrap');
    expect(html).toContain('sm:max-w-none');
  });

  it('groups secondary actions in a real wrapper — never a labelled display:contents box', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="العقود" secondaryActions={<button type="button">تصدير CSV</button>} />,
    );
    expect(html).toContain('aria-label="إجراءات ثانوية"');
    expect(html).not.toContain('class="contents"');
  });

  it('keeps the deprecated action prop working while primaryAction takes precedence', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="x" action={<b>قديم</b>} primaryAction={<i>جديد</i>} />,
    );
    expect(html).toContain('جديد');
    expect(html).not.toContain('قديم');
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
