import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilterBar } from '@/components/ui/filter-bar';

describe('FilterBar — سطح البحث والفلاتر الموحد', () => {
  it('wraps controls in the shared data-filter-bar section', () => {
    const html = renderToStaticMarkup(
      <FilterBar
        searchValue=""
        onSearchChange={() => {}}
        searchAriaLabel="بحث"
        filters={<select aria-label="الحالة"><option>الكل</option></select>}
      />,
    );

    expect(html).toContain('data-filter-bar');
    expect(html).toContain('data-register-toolbar');
    expect(html).toContain('aria-label="البحث والتصفية"');
    expect(html).toContain('aria-label="بحث"');
    expect(html).toContain('aria-label="الحالة"');
  });

  it('applies the shared surface tokens (border/card/radius/shadow)', () => {
    const html = renderToStaticMarkup(<FilterBar actions={<button type="button">x</button>} />);

    expect(html).toContain('border-border/70');
    expect(html).toContain('bg-card');
    expect(html).toContain('rounded-xl');
    expect(html).toContain('shadow-card');
  });

  it('accepts a className override while preserving the canonical aria label', () => {
    const html = renderToStaticMarkup(
      <FilterBar className="mt-4" filters={<button type="button">فلاتر العقود</button>} />,
    );

    expect(html).toContain('mt-4');
    expect(html).toContain('aria-label="البحث والتصفية"');
  });
});
