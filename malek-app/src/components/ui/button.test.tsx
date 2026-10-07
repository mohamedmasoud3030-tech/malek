import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button — الزر التشغيلي الموحد', () => {
  it('renders a native button with variant classes and data hooks', () => {
    const html = renderToStaticMarkup(<Button variant="secondary">حفظ</Button>);
    expect(html).toContain('data-ui-button');
    expect(html).toContain('bg-secondary');
    expect(html).toContain('حفظ');
  });

  it('asChild merges button classes onto the single child element (fragment must not swallow them)', () => {
    const html = renderToStaticMarkup(
      <Button asChild variant="secondary" className="min-h-11">
        <a href="/owners">إدارة الملاك</a>
      </Button>,
    );
    // The fix under test: Radix Slot must receive the anchor directly so the
    // composed className lands on it (a Fragment child strips className).
    expect(html).not.toContain('<button');
    expect(html).toContain('href="/owners"');
    expect(html).toContain('pressable');
    expect(html).toContain('bg-secondary');
    expect(html).toContain('min-h-11');
  });

  it('asChild child element keeps its own classes alongside the button classes', () => {
    const html = renderToStaticMarkup(
      <Button asChild>
        <a href="/x" className="w-full">
          فتح
        </a>
      </Button>,
    );
    expect(html).toContain('w-full');
    expect(html).toContain('bg-primary');
  });

  it('exposes size/loading state hooks on the native button path', () => {
    const html = renderToStaticMarkup(
      <Button size="lg" loading>
        إرسال
      </Button>,
    );
    expect(html).toContain('data-size="lg"');
    expect(html).toContain('data-loading="true"');
    expect(html).toContain('جارٍ التنفيذ...');
  });
});
