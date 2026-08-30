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

  it('applies the shared toolbar tokens: tools, not cards', () => {
    const html = renderToStaticMarkup(
      <FilterBar filters={<select aria-label="الفلاتر"><option>الكل</option></select>} actions={<button type="button">x</button>} />,
    );

    // The toolbar is a quiet edge-to-edge strip; it never becomes a card.
    expect(html).toContain('border-y border-border/50 bg-muted/10 py-2');
    expect(html).toContain('shadow-none');
    // Quick filters sit inline at md+ so routine filtering stays one step away.
    expect(html).toContain('data-quick-filters-desktop');
    expect(html).toContain('data-filter-actions-desktop');
    // The phone trigger remains the single compact affordance.
    expect(html).toContain('md:hidden');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it('accepts a className override while preserving the canonical aria label', () => {
    const html = renderToStaticMarkup(
      <FilterBar className="mt-4" filters={<button type="button">فلاتر العقود</button>} />,
    );

    expect(html).toContain('mt-4');
    expect(html).toContain('aria-label="البحث والتصفية"');
  });
});
