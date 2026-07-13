import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResponsiveCardGrid } from './responsive-card-grid';

describe('ResponsiveCardGrid', () => {
  it('keeps four metric cards in the shared two-by-two layout', () => {
    const html = renderToStaticMarkup(
      <ResponsiveCardGrid>
        <article>الأول</article>
        <article>الثاني</article>
        <article>الثالث</article>
        <article>الرابع</article>
      </ResponsiveCardGrid>,
    );

    expect(html).toContain('grid-cols-2');
    expect(html).not.toContain('sm:grid-cols-3');
    expect(html.match(/<article>/g)).toHaveLength(4);
  });
});
