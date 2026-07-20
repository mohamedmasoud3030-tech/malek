import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ListControlSurface } from './list-controls';

describe('ListControlSurface — سطح البحث والفلاتر الموحد', () => {
  it('wraps controls in the shared data-list-controls section', () => {
    const html = renderToStaticMarkup(
      <ListControlSurface>
        <input aria-label="بحث" />
      </ListControlSurface>,
    );
    expect(html).toContain('data-list-controls');
    expect(html).toContain('aria-label="البحث والتصفية"');
    expect(html).toContain('aria-label="بحث"');
  });

  it('applies the shared surface tokens (border/card/radius/shadow)', () => {
    const html = renderToStaticMarkup(<ListControlSurface>x</ListControlSurface>);
    expect(html).toContain('border-border/70');
    expect(html).toContain('bg-card');
    expect(html).toContain('rounded-2xl');
  });

  it('accepts a className override and a custom aria label', () => {
    const html = renderToStaticMarkup(
      <ListControlSurface className="mt-4" ariaLabel="فلاتر العقود">x</ListControlSurface>,
    );
    expect(html).toContain('mt-4');
    expect(html).toContain('aria-label="فلاتر العقود"');
  });
});
