import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResponsiveCardGrid } from './responsive-card-grid';

describe('ResponsiveCardGrid', () => {
  it('keeps the default four-card layout compact when no desktop override is requested', () => {
    const html = renderToStaticMarkup(
      <ResponsiveCardGrid>
        <article>الأول</article><article>الثاني</article><article>الثالث</article><article>الرابع</article>
      </ResponsiveCardGrid>,
    );
    expect(html).toContain('grid-cols-2');
    expect(html).not.toContain('lg:grid-cols-4');
  });

  it('uses one full desktop row only when a bounded set of four KPIs asks for it', () => {
    const html = renderToStaticMarkup(
      <ResponsiveCardGrid desktopColumns={4}>
        <article>الأول</article><article>الثاني</article><article>الثالث</article><article>الرابع</article>
      </ResponsiveCardGrid>,
    );
    expect(html).toContain('data-desktop-columns="4"');
    expect(html).toContain('lg:grid-cols-4');
  });

  it('does not allow legacy five-plus column requests to create sparse grids', () => {
    const html = renderToStaticMarkup(<ResponsiveCardGrid desktopColumns={5}><article>الأول</article></ResponsiveCardGrid>);
    expect(html).toContain('data-desktop-columns="2"');
    expect(html).not.toContain('lg:grid-cols-4');
  });
});
